// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  eventsCausingActions: {
    decrementTimerCounter: "TIMER_COUNTER_DECREMENTED";
    saveTimerStateToCanister:
      | "TIMER_COUNTER_DECREMENTED"
      | "TIMER_COUNTER_DELETED"
      | "TIMER_COUNTER_INCREMENTED"
      | "TIMER_COUNTER_LABEL_CHANGED";
    deleteTimerCounter: "TIMER_COUNTER_DELETED";
    incrementTimerCounter: "TIMER_COUNTER_INCREMENTED" | "";
    updateTimerCounterLabel: "TIMER_COUNTER_LABEL_CHANGED";
    setTimerCountdown: "TIMER_INTERVAL_SET";
    resetTimerCountdown: "COUNTDOWN_TIMER_RESET";
    decrementTimerCountdown: "ONE_SECOND_ELAPSED";
    playEndSound: "";
  };
  internalEvents: {
    "": { type: "" };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {};
  missingImplementations: {
    actions: never;
    services: never;
    guards: never;
    delays: never;
  };
  eventsCausingServices: {};
  eventsCausingGuards: {
    isTimerCountdownZero: "";
  };
  eventsCausingDelays: {};
  matchesStates: "new" | "timerSet" | "running" | "paused" | "finished";
  tags: never;
}
