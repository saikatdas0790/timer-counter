import { assign, createMachine, sendParent } from "xstate";

const timerIntervals = [
  {
    label: "15M",
    valueInSeconds: 900, // 15 * 60
  },
  {
    label: "30M",
    valueInSeconds: 1800, // 30 * 60
  },
  {
    label: "1H",
    valueInSeconds: 3600, // 60 * 60
  },
] as const;

type TimerInterval = typeof timerIntervals[number];

export type Timer = {
  currentInterval: TimerInterval;
  runningHistory: {
    interval: TimerInterval;
    startTime: number;
  }[];
};

const timerCounterMachine = createMachine(
  {
    tsTypes: {} as import("./TimerCounter.typegen").Typegen0,
    schema: {
      context: {} as {
        remainingTimeInSeconds: number;
        timerLabel: string;
        currentCount: number;
      },
      events: {} as
        | { type: "TIMER_INTERVAL_SET"; intervalValue: TimerInterval }
        | { type: "COUNTDOWN_TIMER_PLAY_PAUSED" }
        | { type: "COUNTDOWN_TIMER_RESET" }
        | { type: "TIMER_COUNTER_INCREMENTED" }
        | { type: "TIMER_COUNTER_DECREMENTED" }
        | { type: "TIMER_COUNTER_LABEL_CHANGED"; updatedLabel: string }
        | { type: "TIMER_COUNTER_DELETED"; timerId: string }
        | { type: "ONE_SECOND_ELAPSED" },
    },
    context: {
      remainingTimeInSeconds: 0,
      timerLabel: "New Timer Counter",
      currentCount: 0,
    },
    on: {
      TIMER_COUNTER_DECREMENTED: {
        actions: ["decrementTimerCounter", "saveTimerStateToCanister"],
      },
      TIMER_COUNTER_DELETED: {
        actions: ["deleteTimerCounter", "saveTimerStateToCanister"],
      },
      TIMER_COUNTER_INCREMENTED: {
        actions: ["incrementTimerCounter", "saveTimerStateToCanister"],
      },
      TIMER_COUNTER_LABEL_CHANGED: {
        actions: ["updateTimerCounterLabel", "saveTimerStateToCanister"],
      },
    },
    initial: "new",
    states: {
      new: {
        on: {
          TIMER_INTERVAL_SET: {
            actions: "setTimerCountdown",
            target: "timerSet",
          },
        },
      },
      timerSet: {
        on: {
          TIMER_INTERVAL_SET: {
            actions: "setTimerCountdown",
            target: "timerSet",
          },
          COUNTDOWN_TIMER_PLAY_PAUSED: {
            target: "running",
          },
          COUNTDOWN_TIMER_RESET: {
            target: "new",
            actions: "resetTimerCountdown",
          },
        },
      },
      running: {
        on: {
          COUNTDOWN_TIMER_PLAY_PAUSED: {
            target: "paused",
          },
          ONE_SECOND_ELAPSED: {
            actions: "decrementTimerCountdown",
            target: "running",
          },
        },
        always: {
          cond: "isTimerCountdownZero",
          target: "finished",
        },
      },
      paused: {
        on: {
          COUNTDOWN_TIMER_PLAY_PAUSED: {
            target: "running",
          },
          COUNTDOWN_TIMER_RESET: {
            target: "new",
            actions: "resetTimerCountdown",
          },
        },
      },
      finished: {
        on: {
          COUNTDOWN_TIMER_RESET: {
            target: "new",
            actions: "resetTimerCountdown",
          },
        },
        entry: ["incrementTimerCounter", "playEndSound"],
      },
    },
  },
  {
    actions: {
      decrementTimerCountdown: assign({
        remainingTimeInSeconds: (context) => context.remainingTimeInSeconds - 1,
      }),
      decrementTimerCounter: assign({
        currentCount: (context) =>
          context.currentCount > 0 ? context.currentCount - 1 : 0,
      }),
      deleteTimerCounter: sendParent((context, event) => ({
        type: "TIMER_COUNTER_DELETE_RECEIVED",
        timerId: event.timerId,
      })),
      incrementTimerCounter: assign({
        currentCount: (context) => context.currentCount + 1,
      }),
      playEndSound: () => {
        const audio = new Audio("/timer-end.ogg");
        audio.play();
      },
      resetTimerCountdown: assign({
        remainingTimeInSeconds: (context, event) => {
          return 0;
        },
      }),
      saveTimerStateToCanister: sendParent((context, event) => ({
        type: "TIMER_COUNTER_STATE_CHANGED",
      })),
      setTimerCountdown: assign({
        remainingTimeInSeconds: (context, event) => {
          return event.intervalValue.valueInSeconds;
        },
      }),
      updateTimerCounterLabel: assign({
        timerLabel: (context, event) => event.updatedLabel,
      }),
    },
    guards: {
      isTimerCountdownZero: (context) => {
        return context.remainingTimeInSeconds === 0;
      },
    },
  },
);

export { timerCounterMachine, timerIntervals, type TimerInterval };
