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
      // Ephemeral: set from input on spawn, cleared after the first
      // always-transition away from "new" so that COUNTDOWN_TIMER_RESET
      // (which returns to "new") doesn't trigger the restore a second time.
      _initialTimerState: string;
    },
    events: {} as
      | { type: "TIMER_INTERVAL_SET"; intervalValue: TimerInterval }
      | { type: "COUNTDOWN_TIMER_PLAY_PAUSED" }
      | { type: "COUNTDOWN_TIMER_RESET" }
      | { type: "TIMER_COUNTER_INCREMENTED" }
      | { type: "TIMER_COUNTER_DECREMENTED" }
      | { type: "TIMER_COUNTER_LABEL_CHANGED"; updatedLabel: string }
      | { type: "TIMER_COUNTER_DELETED"; timerId: string }
      | { type: "SECONDS_ELAPSED"; seconds: number }
      | {
        type: "TIMER_STATE_SYNCED_FROM_REMOTE";
        timerLabel: string;
        currentCount: number;
        remainingTimeInSeconds: number;
        timerState: string;
      },
    input: {} as {
      remainingTimeInSeconds?: number;
      timerLabel?: string;
      currentCount?: number;
      // Persist and restore the XState state value so a page reload caused by
      // an auth redirect returns the timer to its exact state.
      timerState?: string;
    },
  },
  actions: {
    decrementTimerCountdown: assign({
      remainingTimeInSeconds: ({ context, event }) => {
        const seconds =
          (event as Extract<typeof event, { type: "SECONDS_ELAPSED" }>)
            .seconds ?? 1;
        return Math.max(0, context.remainingTimeInSeconds - seconds);
      },
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
      const audio = new Audio("/static/timer-end.ogg");
      audio.play();
    },
    resetTimerCountdown: assign({
      remainingTimeInSeconds: () => 0,
    }),
    syncTimerState: sendParent({
      type: "TIMER_COUNTER_STATE_CHANGED",
    }),
    // Applies a full context update from SpacetimeDB without notifying the
    // parent (no syncTimerState), so the update is not echoed back to STDB.
    syncFromRemote: assign(({ event }) => {
      const e = event as Extract<
        typeof event,
        { type: "TIMER_STATE_SYNCED_FROM_REMOTE" }
      >;
      return {
        timerLabel: e.timerLabel,
        currentCount: e.currentCount,
        remainingTimeInSeconds: e.remainingTimeInSeconds,
      };
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
    _initialTimerState: input?.timerState ?? "new",
  }),
  on: {
    TIMER_STATE_SYNCED_FROM_REMOTE: [
      {
        guard: ({ event }) => event.timerState === "running",
        target: ".running",
        actions: "syncFromRemote",
      },
      {
        guard: ({ event }) => event.timerState === "paused",
        target: ".paused",
        actions: "syncFromRemote",
      },
      {
        guard: ({ event }) => event.timerState === "timerSet",
        target: ".timerSet",
        actions: "syncFromRemote",
      },
      {
        guard: ({ event }) => event.timerState === "finished",
        target: ".finished",
        actions: "syncFromRemote",
      },
      // default: "new" (covers "new" and any unknown value)
      { target: ".new", actions: "syncFromRemote" },
    ],
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
      // If this actor was spawned with a non-default timerState (from
      // localStorage or STDB), transition away immediately using always.
      // This avoids the spawn+send timing race where an event sent to a
      // newly-spawned actor can be dropped before its event loop starts.
      // _initialTimerState is cleared after the transition so navigating
      // back to "new" via COUNTDOWN_TIMER_RESET doesn't re-trigger it.
      always: [
        {
          guard: ({ context }) => context._initialTimerState === "running",
          target: "running",
          actions: assign({ _initialTimerState: () => "new" }),
        },
        {
          guard: ({ context }) => context._initialTimerState === "paused",
          target: "paused",
          actions: assign({ _initialTimerState: () => "new" }),
        },
        {
          guard: ({ context }) => context._initialTimerState === "timerSet",
          target: "timerSet",
          actions: assign({ _initialTimerState: () => "new" }),
        },
        {
          guard: ({ context }) => context._initialTimerState === "finished",
          target: "finished",
          actions: assign({ _initialTimerState: () => "new" }),
        },
      ],
      on: {
        TIMER_INTERVAL_SET: {
          actions: ["setTimerCountdown", "syncTimerState"],
          target: "timerSet",
        },
      },
    },
    timerSet: {
      on: {
        TIMER_INTERVAL_SET: {
          actions: ["setTimerCountdown", "syncTimerState"],
          target: "timerSet",
        },
        COUNTDOWN_TIMER_PLAY_PAUSED: {
          target: "running",
        },
        COUNTDOWN_TIMER_RESET: {
          target: "new",
          actions: ["resetTimerCountdown", "syncTimerState"],
        },
      },
    },
    running: {
      on: {
        COUNTDOWN_TIMER_PLAY_PAUSED: {
          target: "paused",
          actions: "syncTimerState",
        },
        SECONDS_ELAPSED: {
          actions: ["decrementTimerCountdown", "syncTimerState"],
          target: "running",
        },
      },
      always: {
        guard: "isTimerCountdownZero",
        target: "finished",
        actions: ["incrementTimerCounter", "playEndSound"],
      },
    },
    paused: {
      on: {
        COUNTDOWN_TIMER_PLAY_PAUSED: {
          target: "running",
        },
        COUNTDOWN_TIMER_RESET: {
          target: "new",
          actions: ["resetTimerCountdown", "syncTimerState"],
        },
      },
    },
    finished: {
      on: {
        COUNTDOWN_TIMER_RESET: {
          target: "new",
          actions: ["resetTimerCountdown", "syncTimerState"],
        },
      },
    },
  },
});

export { timerCounterMachine, timerIntervals, type TimerInterval };
