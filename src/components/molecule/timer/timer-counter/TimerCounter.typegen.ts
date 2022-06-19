// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  eventsCausingActions: {
    decrementTimerCounter: "TIMER_COUNTER_DECREMENTED";
    deleteTimerCounter: "TIMER_COUNTER_DELETED";
    incrementTimerCounter: "TIMER_COUNTER_INCREMENTED" | "";
    updateTimerCounterLabel: "TIMER_COUNTER_LABEL_CHANGED";
    setTimerCountdown: "TIMER_INTERVAL_SET";
    resetTimerCountdown: "COUNTDOWN_TIMER_RESET";
    decrementTimerCountdown: "xstate.after(1000)#(machine).running";
    playEndSound: "";
  };
  internalEvents: {
    "": { type: "" };
    "xstate.after(1000)#(machine).running": {
      type: "xstate.after(1000)#(machine).running";
    };
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
