"use client";

import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { createDbConnection } from "@/lib/spacetimedb";
import { TimerListContext } from "@/lib/timerListContext";

/**
 * Headless component that bridges the timerListMachine with SpacetimeDB.
 * Must be rendered inside both OidcProvider and TimerListContext.Provider.
 *
 * STDB → machine: sends STDB_SYNC_APPLIED / STDB_TIMER_INSERTED / STDB_TIMER_DELETED / STDB_ID_LINKED
 * Machine → STDB: watches state changes, calls createTimerCounter / updateTimerCounter / deleteTimerCounter
 *
 * Sync preference: ALL timer state (label, count, remainingTime, timerState) is always synced to STDB
 * so that any device can resume from where another left off. Echo suppression is done via
 * lastUploadedValues — we only upload a timer when its local values differ from the last
 * values we sent to (or received from) STDB, preventing infinite re-upload loops.
 */
export function SyncBridge() {
    const auth = useAuth();
    const actorRef = TimerListContext.useActorRef();

    useEffect(() => {
        const token = auth.user?.access_token;
        if (!token) return;

        const conn = createDbConnection(token);

        // FIFO queue of local actorIds whose STDB create is in-flight
        const pendingCreates: string[] = [];
        // Actor IDs deleted by this device (skip re-issuing delete to STDB)
        const stdbOriginDeletions = new Set<string>();
        // Last values uploaded to (or confirmed from) STDB per actor ID.
        // actorRef.subscribe only calls updateTimerCounter when current values
        // differ from this snapshot — prevents re-uploading STDB-originated data
        // and stops the echo loop that silences genuine remote updates.
        type UploadedValues = {
            label: string;
            currentCount: number;
            remainingTimeInSeconds: number;
            timerState: string;
        };
        const lastUploadedValues = new Map<string, UploadedValues>();
        // True after the first subscription.onApplied fires
        let initialized = false;
        let synced = false;
        let prevTimerIds = new Set<string>();

        // ── STDB → machine ──────────────────────────────────────────────────────

        conn.db.timer_counter.onInsert((_, row) => {
            if (!initialized) return; // initial subscription rows are handled via onApplied
            const pendingActorId = pendingCreates.shift();
            if (pendingActorId !== undefined) {
                // Confirmation of our own local create — link STDB id to local actor id.
                // Pre-populate lastUploadedValues so subscribe doesn't re-upload it.
                lastUploadedValues.set(pendingActorId, {
                    label: row.label,
                    currentCount: row.currentCount,
                    remainingTimeInSeconds: row.remainingTimeSeconds,
                    timerState: row.timerState,
                });
                actorRef.send({
                    type: "STDB_ID_LINKED",
                    actorId: pendingActorId,
                    stdbId: row.id,
                });
            } else {
                // Remote insert from another device.
                // Pre-populate lastUploadedValues so subscribe doesn't re-upload it.
                lastUploadedValues.set(`stdb-${row.id}`, {
                    label: row.label,
                    currentCount: row.currentCount,
                    remainingTimeInSeconds: row.remainingTimeSeconds,
                    timerState: row.timerState,
                });
                actorRef.send({
                    type: "STDB_TIMER_INSERTED",
                    row: {
                        id: row.id,
                        label: row.label,
                        currentCount: row.currentCount,
                        remainingTimeSeconds: row.remainingTimeSeconds,
                        timerState: row.timerState,
                    },
                });
            }
        });

        conn.db.timer_counter.onUpdate((_, _oldRow, newRow) => {
            if (!initialized) return;
            const snapshot = actorRef.getSnapshot();
            const actorId = Object.entries(snapshot.context.stdbIdMap).find(
                ([, id]) => id === newRow.id,
            )?.[0];
            // Update lastUploadedValues with the STDB-confirmed values so that
            // actorRef.subscribe won't re-upload them after dispatching to the machine.
            const incomingValues: UploadedValues = {
                label: newRow.label,
                currentCount: newRow.currentCount,
                remainingTimeInSeconds: newRow.remainingTimeSeconds,
                timerState: newRow.timerState,
            };
            if (actorId) {
                const last = lastUploadedValues.get(actorId);
                // If every field matches what we last uploaded, this is our own echo.
                // Update lastUploadedValues (the STDB-confirmed snapshot) and skip
                // dispatching to the machine to avoid unnecessary transitions.
                if (
                    last &&
                    last.label === incomingValues.label &&
                    last.currentCount === incomingValues.currentCount &&
                    last.remainingTimeInSeconds ===
                    incomingValues.remainingTimeInSeconds &&
                    last.timerState === incomingValues.timerState
                ) {
                    return;
                }
                lastUploadedValues.set(actorId, incomingValues);
            }
            actorRef.send({
                type: "STDB_TIMER_UPDATED",
                row: {
                    id: newRow.id,
                    label: newRow.label,
                    currentCount: newRow.currentCount,
                    remainingTimeSeconds: newRow.remainingTimeSeconds,
                    timerState: newRow.timerState,
                },
            });
        });

        conn.db.timer_counter.onDelete((_, row) => {
            const snapshot = actorRef.getSnapshot();
            const actorId = Object.entries(snapshot.context.stdbIdMap).find(
                ([, id]) => id === row.id,
            )?.[0];
            if (actorId) stdbOriginDeletions.add(actorId);
            actorRef.send({ type: "STDB_TIMER_DELETED", stdbId: row.id });
        });

        conn
            .subscriptionBuilder()
            .onApplied((subCtx) => {
                const rows = Array.from(subCtx.db.timer_counter.iter());
                // Set prevTimerIds to the incoming STDB actor IDs before sending the
                // event so that the actorRef.subscribe handler sees no diff.
                prevTimerIds = new Set(rows.map((r) => `stdb-${r.id}`));
                // Pre-populate lastUploadedValues with STDB data so that the
                // actorRef.subscribe callback doesn't re-upload them after the machine
                // processes STDB_SYNC_APPLIED and transitions.
                for (const r of rows) {
                    lastUploadedValues.set(`stdb-${r.id}`, {
                        label: r.label,
                        currentCount: r.currentCount,
                        remainingTimeInSeconds: r.remainingTimeSeconds,
                        timerState: r.timerState,
                    });
                }
                initialized = true;
                synced = true;
                actorRef.send({
                    type: "STDB_SYNC_APPLIED",
                    rows: rows.map((r) => ({
                        id: r.id,
                        label: r.label,
                        currentCount: r.currentCount,
                        remainingTimeSeconds: r.remainingTimeSeconds,
                        timerState: r.timerState,
                    })),
                });
            })
            .onError(() => {
                // subscription failed — stay in unsynced mode
            })
            .subscribe("SELECT * FROM timer_counter");

        // ── Machine → STDB ──────────────────────────────────────────────────────

        // Force-uploads all running timers to STDB immediately. Called when the
        // tab goes to background so that throttling can't cause the last known
        // state to go unsaved. Only running timers need this — paused/stopped
        // timers haven't changed since the last subscribe-driven upload.
        function forceFlushRunningTimers() {
            if (!synced) return;
            const snapshot = actorRef.getSnapshot();
            if (!snapshot.matches("ready")) return;
            for (const timerRef of snapshot.context.timers) {
                const stdbId = snapshot.context.stdbIdMap[timerRef.id];
                if (stdbId === undefined) continue;
                const timerSnapshot = timerRef.getSnapshot();
                if (timerSnapshot?.value !== "running") continue;
                const ctx = timerSnapshot?.context;
                if (!ctx) continue;
                const timerState = (timerSnapshot?.value as string | undefined) ?? "new";
                // Record before calling the reducer so the echo in onUpdate is suppressed.
                lastUploadedValues.set(timerRef.id, {
                    label: ctx.timerLabel,
                    currentCount: ctx.currentCount,
                    remainingTimeInSeconds: ctx.remainingTimeInSeconds,
                    timerState,
                });
                conn.reducers
                    .updateTimerCounter({
                        id: stdbId,
                        label: ctx.timerLabel,
                        currentCount: ctx.currentCount,
                        remainingTimeSeconds: ctx.remainingTimeInSeconds,
                        timerState,
                    })
                    .catch(() => {
                        lastUploadedValues.delete(timerRef.id);
                    });
            }
        }

        const machSub = actorRef.subscribe((snapshot) => {
            if (!snapshot.matches("ready") || !synced) return;

            const currentTimers = snapshot.context.timers;
            const currentIds = new Set(currentTimers.map((t) => t.id));

            // New local timers (not from STDB)
            for (const id of currentIds) {
                if (!prevTimerIds.has(id) && !id.startsWith("stdb-")) {
                    const label =
                        currentTimers.find((t) => t.id === id)?.getSnapshot()?.context
                            ?.timerLabel ?? "";
                    pendingCreates.push(id);
                    conn.reducers.createTimerCounter({ label }).catch(() => {
                        const idx = pendingCreates.indexOf(id);
                        if (idx !== -1) pendingCreates.splice(idx, 1);
                    });
                }
            }

            // Locally deleted timers
            for (const id of prevTimerIds) {
                if (!currentIds.has(id) && !stdbOriginDeletions.has(id)) {
                    const stdbId = snapshot.context.stdbIdMap[id];
                    if (stdbId !== undefined) {
                        conn.reducers.deleteTimerCounter({ id: stdbId }).catch(() => { });
                    }
                }
                stdbOriginDeletions.delete(id);
            }

            // Upload state for all linked timers, but ONLY when current values
            // differ from what was last uploaded/received. This prevents:
            // 1. Re-uploading STDB-originated data after STDB_TIMER_UPDATED /
            //    STDB_SYNC_APPLIED triggers actorRef.subscribe.
            // 2. The pendingUpdates counter growing unboundedly from STDB-event
            //    transitions, which used to silence genuine remote updates.
            for (const timerRef of currentTimers) {
                const stdbId = snapshot.context.stdbIdMap[timerRef.id];
                if (stdbId !== undefined) {
                    const ctx = timerRef.getSnapshot()?.context;
                    const timerState =
                        (timerRef.getSnapshot()?.value as string | undefined) ?? "new";
                    if (ctx) {
                        const last = lastUploadedValues.get(timerRef.id);
                        // Skip if nothing changed since last upload
                        if (
                            last &&
                            last.label === ctx.timerLabel &&
                            last.currentCount === ctx.currentCount &&
                            last.remainingTimeInSeconds === ctx.remainingTimeInSeconds &&
                            last.timerState === timerState
                        ) {
                            continue;
                        }
                        // Record what we're about to upload BEFORE calling the reducer so
                        // that the STDB echo arriving in onUpdate matches and is suppressed.
                        lastUploadedValues.set(timerRef.id, {
                            label: ctx.timerLabel,
                            currentCount: ctx.currentCount,
                            remainingTimeInSeconds: ctx.remainingTimeInSeconds,
                            timerState,
                        });
                        conn.reducers
                            .updateTimerCounter({
                                id: stdbId,
                                label: ctx.timerLabel,
                                currentCount: ctx.currentCount,
                                remainingTimeSeconds: ctx.remainingTimeInSeconds,
                                timerState,
                            })
                            .catch(() => {
                                // On failure clear the entry so the next subscribe call retries.
                                lastUploadedValues.delete(timerRef.id);
                            });
                    }
                }
            }

            prevTimerIds = currentIds;
        });

        function onTabHidden() {
            if (document.visibilityState === "hidden") forceFlushRunningTimers();
        }
        document.addEventListener("visibilitychange", onTabHidden);

        return () => {
            document.removeEventListener("visibilitychange", onTabHidden);
            machSub.unsubscribe();
            conn.disconnect();
        };
    }, [auth.user?.access_token, actorRef]);

    return null;
}
