import { assign, sendParent, setup } from "xstate";

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

type TimerInterval = (typeof timerIntervals)[number];

export type Timer = {
  currentInterval: TimerInterval;
  runningHistory: {
    interval: TimerInterval;
    startTime: number;
  }[];
};

const timerCounterMachine = setup({
  types: {
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
    input: {} as {
      remainingTimeInSeconds?: number;
      timerLabel?: string;
      currentCount?: number;
    },
  },
  actions: {
    decrementTimerCountdown: assign({
      remainingTimeInSeconds: ({ context }) =>
        context.remainingTimeInSeconds - 1,
    }),
    decrementTimerCounter: assign({
      currentCount: ({ context }) =>
        context.currentCount > 0 ? context.currentCount - 1 : 0,
    }),
    deleteTimerCounter: sendParent(({ event }) => ({
      type: "TIMER_COUNTER_DELETE_RECEIVED" as const,
      timerId: (
        event as Extract<typeof event, { type: "TIMER_COUNTER_DELETED" }>
      ).timerId,
    })),
    incrementTimerCounter: assign({
      currentCount: ({ context }) => context.currentCount + 1,
    }),
    playEndSound: () => {
      const audio = new Audio("/timer-end.ogg");
      audio.play();
    },
    resetTimerCountdown: assign({
      remainingTimeInSeconds: () => 0,
    }),
    syncTimerState: sendParent({
      type: "TIMER_COUNTER_STATE_CHANGED",
    }),
    setTimerCountdown: assign({
      remainingTimeInSeconds: ({ event }) =>
        (event as Extract<typeof event, { type: "TIMER_INTERVAL_SET" }>)
          .intervalValue.valueInSeconds,
    }),
    updateTimerCounterLabel: assign({
      timerLabel: ({ event }) =>
        (
          event as Extract<
            typeof event,
            { type: "TIMER_COUNTER_LABEL_CHANGED" }
          >
        ).updatedLabel,
    }),
  },
  guards: {
    isTimerCountdownZero: ({ context }) => context.remainingTimeInSeconds === 0,
  },
}).createMachine({
  context: ({ input }) => ({
    remainingTimeInSeconds: input?.remainingTimeInSeconds ?? 0,
    timerLabel: input?.timerLabel ?? "New Timer Counter",
    currentCount: input?.currentCount ?? 0,
  }),
  on: {
    TIMER_COUNTER_DECREMENTED: {
      actions: ["decrementTimerCounter", "syncTimerState"],
    },
    TIMER_COUNTER_DELETED: {
      actions: ["deleteTimerCounter", "syncTimerState"],
    },
    TIMER_COUNTER_INCREMENTED: {
      actions: ["incrementTimerCounter", "syncTimerState"],
    },
    TIMER_COUNTER_LABEL_CHANGED: {
      actions: ["updateTimerCounterLabel", "syncTimerState"],
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
        guard: "isTimerCountdownZero",
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
});

export { timerCounterMachine, timerIntervals, type TimerInterval };
