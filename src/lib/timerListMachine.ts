import { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";
import { assign, fromPromise, setup, type ActorRefFrom } from "xstate";

type TimerSavedContext = {
  id: string;
  remainingTimeInSeconds: number;
  timerLabel: string;
  currentCount: number;
  timerState?: string;
};

export type StdbTimerRow = {
  id: bigint;
  label: string;
  currentCount: number;
  remainingTimeSeconds: number;
  timerState?: string; // optional — defaults to "new" when absent
};

const timerListMachine = setup({
  types: {
    context: {} as {
      timers: ActorRefFrom<typeof timerCounterMachine>[];
      stdbIdMap: Record<string, bigint>;
    },
    events: {} as
      | { type: "NEW_TIMER_COUNTER_CREATED" }
      | { type: "TIMER_COUNTER_DELETE_RECEIVED"; timerId: string }
      | { type: "TIMER_COUNTER_STATE_CHANGED" }
      | { type: "STDB_ID_LINKED"; actorId: string; stdbId: bigint }
      | { type: "STDB_SYNC_APPLIED"; rows: StdbTimerRow[] }
      | { type: "STDB_TIMER_INSERTED"; row: StdbTimerRow }
      | { type: "STDB_TIMER_UPDATED"; row: StdbTimerRow }
      | { type: "STDB_TIMER_DELETED"; stdbId: bigint },
  },
  actors: {
    loadStateFromLocalDB: fromPromise(async () => {
      const timersFromStorage = localStorage.getItem("timerCounterSavedState");
      if (timersFromStorage) {
        return { timers: JSON.parse(timersFromStorage) as TimerSavedContext[] };
      } else {
        localStorage.setItem("timerCounterSavedState", JSON.stringify([]));
        return { timers: [] as TimerSavedContext[] };
      }
    }),
    timerCounter: timerCounterMachine,
  },
}).createMachine({
  context: { timers: [], stdbIdMap: {} },
  initial: "loadingStateFromLocalDB",
  states: {
    loadingStateFromLocalDB: {
      invoke: {
        src: "loadStateFromLocalDB",
        onDone: {
          target: "ready",
          actions: assign(({ event, spawn }) => {
            const output = (
              event as unknown as { output: { timers: TimerSavedContext[] } }
            ).output;
            return {
              timers: output.timers.map((t) => {
                const timer = spawn("timerCounter", {
                  id: `${t.id}`,
                  input: {
                    currentCount: t.currentCount,
                    remainingTimeInSeconds: t.remainingTimeInSeconds,
                    timerLabel: t.timerLabel,
                    // timerState is read by the timerCounterMachine via
                    // always-transitions in the "new" state so the timer
                    // resumes its exact state after a page reload / auth
                    // redirect without needing a post-spawn send() that
                    // could be dropped before the actor starts processing.
                    timerState: t.timerState,
                  },
                });
                return timer;
              }),
            };
          }),
        },
      },
    },
    ready: {
      on: {
        NEW_TIMER_COUNTER_CREATED: {
          actions: assign(({ context, spawn }) => ({
            timers: [
              ...context.timers,
              spawn("timerCounter", { id: `${Date.now()}`, input: {} }),
            ],
          })),
        },
        TIMER_COUNTER_DELETE_RECEIVED: {
          // Only remove from timers — stdbIdMap entry must stay intact so that
          // SyncBridge can look up the stdbId and call deleteTimerCounter.
          // stdbIdMap is cleaned up by STDB_TIMER_DELETED once STDB confirms
          // the delete (for remote deletions) or by the next STDB_SYNC_APPLIED.
          actions: assign({
            timers: ({ context, event }) =>
              context.timers.filter((timer) => timer.id !== event.timerId),
          }),
        },
        TIMER_COUNTER_STATE_CHANGED: {
          actions: ({ context }) => {
            const allTimersContext = [];
            for (const timerRef of context.timers) {
              const snap = timerRef.getSnapshot();
              const timerContext = snap?.context;
              if (timerContext) {
                allTimersContext.push({
                  id: timerRef.id,
                  ...timerContext,
                  // Persist the XState state value ("running", "paused", etc.)
                  // so that a page reload (e.g. from auth redirect) can
                  // restore the timer to its exact state without waiting for
                  // STDB to confirm it.
                  timerState: (snap?.value as string) ?? "new",
                });
              }
            }
            localStorage.setItem(
              "timerCounterSavedState",
              JSON.stringify(allTimersContext),
            );
          },
        },
        STDB_ID_LINKED: {
          actions: assign({
            stdbIdMap: ({ context, event }) => ({
              ...context.stdbIdMap,
              [event.actorId]: event.stdbId,
            }),
          }),
        },
        STDB_SYNC_APPLIED: {
          actions: assign(({ context, event, spawn }) => {
            const rowMap = new Map<string, StdbTimerRow>(
              event.rows.map((r) => [`stdb-${r.id}`, r]),
            );
            const existingMap = new Map(context.timers.map((t) => [t.id, t]));

            // Update actors that already exist locally — this preserves the
            // user's established timer order (from localStorage) instead of
            // replacing the array with whatever order STDB iter() returns.
            for (const [actorId, row] of rowMap) {
              const existing = existingMap.get(actorId);
              if (existing) {
                existing.send({
                  type: "TIMER_STATE_SYNCED_FROM_REMOTE",
                  timerState: row.timerState ?? "new",
                  timerLabel: row.label,
                  currentCount: row.currentCount,
                  remainingTimeInSeconds: row.remainingTimeSeconds,
                });
              }
            }

            // Timers that exist in STDB, kept in their current (user) order.
            const kept = context.timers.filter((t) => rowMap.has(t.id));

            // Timers that are new in STDB (no local actor yet) — appended in
            // the order they appear in the STDB response.
            const added = event.rows
              .filter((row) => !existingMap.has(`stdb-${row.id}`))
              .map((row) => {
                const actorId = `stdb-${row.id}`;
                const timer = spawn("timerCounter", {
                  id: actorId,
                  input: {
                    currentCount: row.currentCount,
                    remainingTimeInSeconds: row.remainingTimeSeconds,
                    timerLabel: row.label,
                  },
                });
                timer.send({
                  type: "TIMER_STATE_SYNCED_FROM_REMOTE",
                  timerState: row.timerState ?? "new",
                  timerLabel: row.label,
                  currentCount: row.currentCount,
                  remainingTimeInSeconds: row.remainingTimeSeconds,
                });
                return timer;
              });

            const timers = [...kept, ...added];

            const stdbIdMap: Record<string, bigint> = {};
            for (const row of event.rows) {
              stdbIdMap[`stdb-${row.id}`] = row.id;
            }

            // Persist to localStorage including timerState so that page
            // reloads can restore running/paused state without waiting for
            // STDB to reconnect.
            const allTimersContext = timers.map((t) => {
              const row = rowMap.get(t.id);
              return {
                id: t.id,
                timerLabel: row?.label ?? "",
                currentCount: row?.currentCount ?? 0,
                remainingTimeInSeconds: row?.remainingTimeSeconds ?? 0,
                timerState: row?.timerState ?? "new",
              };
            });
            localStorage.setItem(
              "timerCounterSavedState",
              JSON.stringify(allTimersContext),
            );

            return { timers, stdbIdMap };
          }),
        },
        STDB_TIMER_INSERTED: {
          actions: assign(({ context, event, spawn }) => {
            const actorId = `stdb-${event.row.id}`;
            if (context.timers.some((t) => t.id === actorId)) return {};
            const timer = spawn("timerCounter", {
              id: actorId,
              input: {
                currentCount: event.row.currentCount,
                remainingTimeInSeconds: event.row.remainingTimeSeconds,
                timerLabel: event.row.label,
              },
            });
            timer.send({
              type: "TIMER_STATE_SYNCED_FROM_REMOTE",
              timerState: event.row.timerState ?? "new",
              timerLabel: event.row.label,
              currentCount: event.row.currentCount,
              remainingTimeInSeconds: event.row.remainingTimeSeconds,
            });
            return {
              timers: [...context.timers, timer],
              stdbIdMap: { ...context.stdbIdMap, [actorId]: event.row.id },
            };
          }),
        },
        STDB_TIMER_UPDATED: {
          // Find the child actor and send it the remote values directly.
          // syncFromRemote deliberately does NOT call syncTimerState, so
          // actorRef.subscribe (SyncBridge) will NOT re-upload to STDB.
          actions: ({ context, event }) => {
            const actorId = Object.entries(context.stdbIdMap).find(
              ([, id]) => id === event.row.id,
            )?.[0];
            if (!actorId) return;
            const timerRef = context.timers.find((t) => t.id === actorId);
            timerRef?.send({
              type: "TIMER_STATE_SYNCED_FROM_REMOTE",
              timerLabel: event.row.label,
              currentCount: event.row.currentCount,
              remainingTimeInSeconds: event.row.remainingTimeSeconds,
              timerState: event.row.timerState ?? "new",
            });
          },
        },
        STDB_TIMER_DELETED: {
          actions: assign(({ context, event }) => {
            const actorId = Object.entries(context.stdbIdMap).find(
              ([, id]) => id === event.stdbId,
            )?.[0];
            if (!actorId) return {};
            const map = { ...context.stdbIdMap };
            delete map[actorId];
            return {
              timers: context.timers.filter((t) => t.id !== actorId),
              stdbIdMap: map,
            };
          }),
        },
      },
    },
  },
});

export { timerListMachine };
