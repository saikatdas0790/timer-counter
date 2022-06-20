// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  eventsCausingActions: {
    setLoadedTimerDataToContext: "done.invoke.(machine).timerList.loadingStateFromLocalDB:invocation[0]";
    addNewTimerActorToTimerList: "NEW_TIMER_COUNTER_CREATED";
    removeTimerActorFromTimerList: "TIMER_COUNTER_DELETE_RECEIVED";
    saveTimersListStateToLocalStorage: "xstate.after(5000)#(machine).timerList.ready";
    setAuthenticationStateToContext: "done.invoke.(machine).canisterSync.loadingAuthenticationState:invocation[0]";
    setLoggedInStateToContext: "done.invoke.(machine).canisterSync.loggingIn:invocation[0]";
    setLoggedOutStateToContext: "error.platform.(machine).canisterSync.loggingIn:invocation[0]";
    pushLocalStateToBackend: "xstate.after(30000)#(machine).canisterSync.loggedIn.ready";
    mergeSyncedStateWithLocalStateAndReinitializeTimers: "done.invoke.(machine).canisterSync.loggedIn.syncInitiated:invocation[0]";
  };
  internalEvents: {
    "done.invoke.(machine).timerList.loadingStateFromLocalDB:invocation[0]": {
      type: "done.invoke.(machine).timerList.loadingStateFromLocalDB:invocation[0]";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "xstate.after(5000)#(machine).timerList.ready": {
      type: "xstate.after(5000)#(machine).timerList.ready";
    };
    "done.invoke.(machine).canisterSync.loadingAuthenticationState:invocation[0]": {
      type: "done.invoke.(machine).canisterSync.loadingAuthenticationState:invocation[0]";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "done.invoke.(machine).canisterSync.loggingIn:invocation[0]": {
      type: "done.invoke.(machine).canisterSync.loggingIn:invocation[0]";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "error.platform.(machine).canisterSync.loggingIn:invocation[0]": {
      type: "error.platform.(machine).canisterSync.loggingIn:invocation[0]";
      data: unknown;
    };
    "xstate.after(30000)#(machine).canisterSync.loggedIn.ready": {
      type: "xstate.after(30000)#(machine).canisterSync.loggedIn.ready";
    };
    "done.invoke.(machine).canisterSync.loggedIn.syncInitiated:invocation[0]": {
      type: "done.invoke.(machine).canisterSync.loggedIn.syncInitiated:invocation[0]";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "error.platform.(machine).canisterSync.loggedIn.syncInitiated:invocation[0]": {
      type: "error.platform.(machine).canisterSync.loggedIn.syncInitiated:invocation[0]";
      data: unknown;
    };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {
    loadStateFromLocalDB: "done.invoke.(machine).timerList.loadingStateFromLocalDB:invocation[0]";
    loadAuthenticationState: "done.invoke.(machine).canisterSync.loadingAuthenticationState:invocation[0]";
    authenticateWithAuthClient: "done.invoke.(machine).canisterSync.loggingIn:invocation[0]";
    getCurrentUsersSyncedState: "done.invoke.(machine).canisterSync.loggedIn.syncInitiated:invocation[0]";
  };
  missingImplementations: {
    actions: never;
    services: never;
    guards: never;
    delays: never;
  };
  eventsCausingServices: {
    loadStateFromLocalDB: "xstate.init";
    loadAuthenticationState: "xstate.init";
    getCurrentUsersSyncedState:
      | "done.invoke.(machine).canisterSync.loadingAuthenticationState:invocation[0]"
      | "done.invoke.(machine).canisterSync.loggingIn:invocation[0]"
      | "TIMER_COUNTER_SYNCED";
    authenticateWithAuthClient: "LOGIN_INITIATED";
  };
  eventsCausingGuards: {
    isLoggedIn: "done.invoke.(machine).canisterSync.loadingAuthenticationState:invocation[0]";
  };
  eventsCausingDelays: {};
  matchesStates:
    | "timerList"
    | "timerList.loadingStateFromLocalDB"
    | "timerList.ready"
    | "canisterSync"
    | "canisterSync.loadingAuthenticationState"
    | "canisterSync.loggedOut"
    | "canisterSync.loggingIn"
    | "canisterSync.loggedIn"
    | "canisterSync.loggedIn.ready"
    | "canisterSync.loggedIn.syncInitiated"
    | {
        timerList?: "loadingStateFromLocalDB" | "ready";
        canisterSync?:
          | "loadingAuthenticationState"
          | "loggedOut"
          | "loggingIn"
          | "loggedIn"
          | { loggedIn?: "ready" | "syncInitiated" };
      };
  tags: never;
}
