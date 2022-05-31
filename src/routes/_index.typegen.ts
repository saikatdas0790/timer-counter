// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  eventsCausingActions: {
    setLoadedTimerDataToContext: "done.invoke.timerList.loadingStateFromLocalDB:invocation[0]";
    addNewTimerActorToTimerList: "NEW_TIMER_COUNTER_CREATED";
    removeTimerActorFromTimerList: "TIMER_COUNTER_DELETE_RECEIVED";
    saveTimersListStateToLocalStorage: "xstate.after(5000)#timerList.ready";
  };
  internalEvents: {
    "done.invoke.timerList.loadingStateFromLocalDB:invocation[0]": {
      type: "done.invoke.timerList.loadingStateFromLocalDB:invocation[0]";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "xstate.after(5000)#timerList.ready": {
      type: "xstate.after(5000)#timerList.ready";
    };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {
    loadStateFromLocalDB: "done.invoke.timerList.loadingStateFromLocalDB:invocation[0]";
  };
  missingImplementations: {
    actions: never;
    services: never;
    guards: never;
    delays: never;
  };
  eventsCausingServices: {
    loadStateFromLocalDB: "xstate.init";
  };
  eventsCausingGuards: {};
  eventsCausingDelays: {};
  matchesStates: "loadingStateFromLocalDB" | "ready";
  tags: never;
}
