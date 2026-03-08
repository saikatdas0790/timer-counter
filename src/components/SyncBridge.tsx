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
    // Actor IDs whose last change came FROM STDB (skip re-uploading to STDB)
    const stdbOriginDeletions = new Set<string>();
    const stdbOriginUpdates = new Set<string>();
    // True after the first subscription.onApplied fires
    let initialized = false;
    let synced = false;
    let prevTimerIds = new Set<string>();

    // ── STDB → machine ──────────────────────────────────────────────────────

    conn.db.timer_counter.onInsert((_, row) => {
      if (!initialized) return; // initial subscription rows are handled via onApplied
      const pendingActorId = pendingCreates.shift();
      if (pendingActorId !== undefined) {
        // Confirmation of our own local create — link STDB id to local actor id
        actorRef.send({
          type: "STDB_ID_LINKED",
          actorId: pendingActorId,
          stdbId: row.id,
        });
      } else {
        // Remote insert from another device
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
      // Mark this actor so the actorRef.subscribe callback skips the
      // updateTimerCounter call that would otherwise echo it back to STDB.
      const snapshot = actorRef.getSnapshot();
      const actorId = Object.entries(snapshot.context.stdbIdMap).find(
        ([, id]) => id === newRow.id,
      )?.[0];
      if (actorId) stdbOriginUpdates.add(actorId);
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

      // Sync current state for all linked timers (handles label, count, time
      // changes). Skip timers whose update originated from STDB to avoid
      // echoing the same values back.
      for (const timerRef of currentTimers) {
        const stdbId = snapshot.context.stdbIdMap[timerRef.id];
        if (stdbId !== undefined) {
          if (stdbOriginUpdates.has(timerRef.id)) {
            stdbOriginUpdates.delete(timerRef.id);
            continue;
          }
          const ctx = timerRef.getSnapshot()?.context;
          const timerState =
            (timerRef.getSnapshot()?.value as string | undefined) ?? "new";
          if (ctx) {
            conn.reducers
              .updateTimerCounter({
                id: stdbId,
                label: ctx.timerLabel,
                currentCount: ctx.currentCount,
                remainingTimeSeconds: ctx.remainingTimeInSeconds,
                timerState,
              })
              .catch(() => {});
          }
        }
      }

      prevTimerIds = currentIds;
    });

    return () => {
      machSub.unsubscribe();
      conn.disconnect();
    };
  }, [auth.user?.access_token, actorRef]);

  return null;
}
