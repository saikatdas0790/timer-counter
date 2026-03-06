import { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
import { assign, fromPromise, setup, type ActorRefFrom } from "xstate";

type TimerSavedContext = {
  id: string;
  remainingTimeInSeconds: number;
  timerLabel: string;
  currentCount: number;
};

const timerListMachine = setup({
  types: {
    context: {} as {
      timers: ActorRefFrom<typeof timerCounterMachine>[];
    },
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
  context: { timers: [] },
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
              timers: output.timers.map((t) =>
                spawn("timerCounter", {
                  id: `${t.id}`,
                  input: {
                    currentCount: t.currentCount,
                    remainingTimeInSeconds: 0,
                    timerLabel: t.timerLabel,
                  },
                }),
              ),
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
          actions: assign({
            timers: ({ context, event }) => {
              const e = event as {
                type: "TIMER_COUNTER_DELETE_RECEIVED";
                timerId: string;
              };
              return context.timers.filter((timer) => timer.id !== e.timerId);
            },
          }),
        },
        TIMER_COUNTER_STATE_CHANGED: {
          actions: ({ context }) => {
            const allTimersContext = [];
            for (const timerRef of context.timers) {
              const timerContext = timerRef.getSnapshot()?.context;
              if (timerContext) {
                allTimersContext.push({ id: timerRef.id, ...timerContext });
              }
            }
            localStorage.setItem(
              "timerCounterSavedState",
              JSON.stringify(allTimersContext),
            );
          },
        },
      },
    },
  },
});

export { timerListMachine };
