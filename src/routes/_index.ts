import { timerCounterMachine } from "$component/molecule/timer/timer-counter/TimerCounter";
import { assign, createMachine, spawn, type ActorRefFrom } from "xstate";

const timerListMachine = createMachine(
  {
    tsTypes: {} as import("./_index.typegen").Typegen0,
    schema: {
      context: {} as {
        timers: ActorRefFrom<typeof timerCounterMachine>[];
      },
      events: {} as
        | { type: "MACHINE_STATE_LOADED" }
        | { type: "NEW_TIMER_COUNTER_CREATED" }
        | { type: "TIMER_COUNTER_DELETE_RECEIVED"; timerId: string },
      services: {} as {
        loadStateFromLocalDB: {
          data: {
            timers: ({ id: string } & typeof timerCounterMachine.context)[];
          };
        };
      },
    },
    id: "timerList",
    initial: "loadingStateFromLocalDB",
    context: {
      timers: [],
    },
    states: {
      loadingStateFromLocalDB: {
        invoke: {
          src: "loadStateFromLocalDB",
          onDone: {
            actions: "setLoadedTimerDataToContext",
            target: "ready",
          },
        },
      },
      ready: {
        after: {
          5000: {
            target: "ready",
            actions: "saveTimersListStateToLocalStorage",
          },
        },
        on: {
          NEW_TIMER_COUNTER_CREATED: {
            actions: "addNewTimerActorToTimerList",
          },
          TIMER_COUNTER_DELETE_RECEIVED: {
            actions: "removeTimerActorFromTimerList",
          },
        },
      },
    },
  },
  {
    actions: {
      addNewTimerActorToTimerList: assign({
        timers: (context, event) => {
          return [
            ...context.timers,
            spawn(timerCounterMachine, {
              name: `${Date.now()}`,
              sync: true,
            }),
          ];
        },
      }),
      removeTimerActorFromTimerList: assign({
        timers: (context, event) => {
          return context.timers.filter((timer) => timer.id !== event.timerId);
        },
      }),
      saveTimersListStateToLocalStorage: async (context, event) => {
        const allTimersContext = [];
        for (const timerRef of context.timers) {
          const timerContext = timerRef.getSnapshot()?.context;
          if (timerContext) {
            allTimersContext.push({ id: timerRef.id, ...timerContext });
          }
        }
        await localStorage.setItem(
          "timerCounterSavedState",
          JSON.stringify(allTimersContext),
        );
      },
      setLoadedTimerDataToContext: assign({
        timers: (context, event) =>
          event.data.timers.map((individualTimer) =>
            spawn(
              timerCounterMachine.withContext({
                currentCount: individualTimer.currentCount,
                remainingTimeInSeconds: 0,
                timerLabel: individualTimer.timerLabel,
              }),
              `${individualTimer.id}`,
            ),
          ),
      }),
    },
    guards: {},
    services: {
      loadStateFromLocalDB: async () => {
        let timersFromStorage = localStorage.getItem("timerCounterSavedState");

        if (timersFromStorage) {
          return {
            timers: JSON.parse(timersFromStorage),
          };
        } else {
          localStorage.setItem("timerCounterSavedState", JSON.stringify([]));
          return {
            timers: [],
          };
        }
      },
    },
  },
);

export { timerListMachine };
