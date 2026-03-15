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
 * Sync preference: ALL timer state (label, count, timerState, timerStartedAtMs) is always synced to
 * STDB so any device can resume from where another left off. Echo suppression is done via
 * lastUploadedValues — we only upload a timer when its local values differ from the last
 * values we sent to (or received from) STDB, preventing infinite re-upload loops.
 *
 * Running timer timing: instead of uploading a dwindling remaining_time_seconds every second,
 * we store timer_started_at_ms (epoch ms) when play is pressed and keep remaining_time_seconds
 * frozen at the value it had at play time (_remainingAtStart). Any client or reconnect can
 * derive actual remaining = max(0, remaining_time_seconds - round((now - timer_started_at_ms) / 1000)).
 * This eliminates per-second STDB writes for running timers and avoids the post-wakeup
 * revert caused by a stale server value overwriting the wall-clock-corrected local value.
 */
export function SyncBridge() {
  const auth = useAuth();
  const actorRef = TimerListContext.useActorRef();

  useEffect(() => {
    // Don't attempt connection if not authenticated or if there's an auth error
    // (e.g. silent renewal failed). This ensures sync is actually paused when
    // the error banner appears.
    if (!auth.isAuthenticated || auth.error) return;

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
      // For running timers: _remainingAtStart (frozen at play time).
      // For paused/timerSet: the frozen remaining value.
      remainingTimeInSeconds: number;
      timerState: string;
      timerStartedAtMs: bigint;
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
          timerStartedAtMs: row.timerStartedAtMs,
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
          timerStartedAtMs: row.timerStartedAtMs,
        });
        actorRef.send({
          type: "STDB_TIMER_INSERTED",
          row: {
            id: row.id,
            label: row.label,
            currentCount: row.currentCount,
            remainingTimeSeconds: row.remainingTimeSeconds,
            timerState: row.timerState,
            timerStartedAtMs: row.timerStartedAtMs,
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
        timerStartedAtMs: newRow.timerStartedAtMs,
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
          last.timerState === incomingValues.timerState &&
          last.timerStartedAtMs === incomingValues.timerStartedAtMs
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
          timerStartedAtMs: newRow.timerStartedAtMs,
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
            timerStartedAtMs: r.timerStartedAtMs,
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
            timerStartedAtMs: r.timerStartedAtMs,
          })),
        });
      })
      .onError(() => {
        // subscription failed — stay in unsynced mode
      })
      .subscribe("SELECT * FROM timer_counter");

    // ── Machine → STDB ──────────────────────────────────────────────────────

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
            conn.reducers.deleteTimerCounter({ id: stdbId }).catch(() => {});
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
      //
      // For running timers, remaining_time_seconds in STDB stores _remainingAtStart
      // (the frozen remaining at play time) alongside timer_started_at_ms. This
      // means once play is pressed we upload ONCE and never again until
      // play-state changes — no more per-second STDB writes for running timers.
      for (const timerRef of currentTimers) {
        const stdbId = snapshot.context.stdbIdMap[timerRef.id];
        if (stdbId !== undefined) {
          const timerSnap = timerRef.getSnapshot();
          const ctx = timerSnap?.context;
          const timerState =
            (timerSnap?.value as string | undefined) ?? "new";
          if (ctx) {
            const isRunning = timerState === "running";
            // For running timers upload _remainingAtStart (stable, frozen at
            // play time). For all others upload the frozen remainingTimeInSeconds.
            const remainingForUpload = isRunning
              ? ctx._remainingAtStart
              : ctx.remainingTimeInSeconds;
            const timerStartedAtMs = BigInt(ctx.timerStartedAtMs ?? 0);
            const last = lastUploadedValues.get(timerRef.id);
            // Skip if nothing changed since last upload
            if (
              last &&
              last.label === ctx.timerLabel &&
              last.currentCount === ctx.currentCount &&
              last.remainingTimeInSeconds === remainingForUpload &&
              last.timerState === timerState &&
              last.timerStartedAtMs === timerStartedAtMs
            ) {
              continue;
            }
            // Record what we're about to upload BEFORE calling the reducer so
            // that the STDB echo arriving in onUpdate matches and is suppressed.
            lastUploadedValues.set(timerRef.id, {
              label: ctx.timerLabel,
              currentCount: ctx.currentCount,
              remainingTimeInSeconds: remainingForUpload,
              timerState,
              timerStartedAtMs,
            });
            conn.reducers
              .updateTimerCounter({
                id: stdbId,
                label: ctx.timerLabel,
                currentCount: ctx.currentCount,
                remainingTimeSeconds: remainingForUpload,
                timerState,
                timerStartedAtMs,
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

    return () => {
      machSub.unsubscribe();
      conn.disconnect();
    };
  }, [auth.user?.access_token, auth.isAuthenticated, auth.error, actorRef]);

  return null;
}
