import { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
import { assign, createMachine, spawn, type ActorRefFrom } from "xstate";
import { AuthClient } from "@dfinity/auth-client";
import type { ActorSubclass, Identity } from "@dfinity/agent";
import type { _SERVICE } from "$canisters/backend_canister/backend_canister.did";
import {
  backend_canister,
  canisterId,
  createActor,
} from "$canisters/backend_canister/index";
import type { Principal } from "@dfinity/principal";
import { unionWith } from "lodash";

const timerListMachine = createMachine(
  {
    tsTypes: {} as import("./_index.typegen").Typegen0,
    schema: {
      context: {} as {
        timers: ActorRefFrom<typeof timerCounterMachine>[];
        authClient?: AuthClient;
        backendActor?: ActorSubclass<_SERVICE>;
        identity?: Identity;
        lastSyncedState?: ({
          id: string;
        } & typeof timerCounterMachine.context)[];
      },
      events: {} as
        | { type: "LOGIN_INITIATED" }
        | { type: "MACHINE_STATE_LOADED" }
        | { type: "NEW_TIMER_COUNTER_CREATED" }
        | { type: "TIMER_COUNTER_DELETE_RECEIVED"; timerId: string }
        | { type: "TIMER_COUNTER_SYNCED"; timerId: string },
      services: {} as {
        getCurrentUsersSyncedState: {
          data: {
            timers: ({ id: string } & typeof timerCounterMachine.context)[];
          };
        };
        loadAuthenticationState: {
          data: {
            isLoggedIn: boolean;
            authClient: AuthClient;
          };
        };
        loadStateFromLocalDB: {
          data: {
            timers: ({ id: string } & typeof timerCounterMachine.context)[];
          };
        };
      },
    },
    context: {
      timers: [],
      authClient: undefined,
      backendActor: undefined,
      identity: undefined,
      lastSyncedState: undefined,
    },
    type: "parallel",
    states: {
      timerList: {
        initial: "loadingStateFromLocalDB",
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
      canisterSync: {
        initial: "loadingAuthenticationState",
        states: {
          loadingAuthenticationState: {
            invoke: {
              src: "loadAuthenticationState",
              onDone: [
                {
                  actions: "setAuthenticationStateToContext",
                  cond: "isLoggedIn",
                  target: "loggedIn",
                },
                {
                  actions: "setAuthenticationStateToContext",
                  target: "loggedOut",
                },
              ],
            },
          },
          loggedOut: {
            on: {
              LOGIN_INITIATED: {
                target: "loggingIn",
              },
            },
          },
          loggingIn: {
            invoke: {
              src: "authenticateWithAuthClient",
              onDone: {
                target: "loggedIn",
                actions: "setLoggedInStateToContext",
              },
              onError: {
                target: "loggedOut",
                actions: "setLoggedOutStateToContext",
              },
            },
          },
          loggedIn: {
            initial: "syncInitiated",
            states: {
              ready: {
                after: {
                  30000: {
                    actions: "pushLocalStateToBackend",
                    target: "ready",
                  },
                },
                on: {
                  TIMER_COUNTER_SYNCED: {
                    target: "syncInitiated",
                  },
                },
              },
              syncInitiated: {
                invoke: {
                  src: "getCurrentUsersSyncedState",
                  onDone: {
                    actions:
                      "mergeSyncedStateWithLocalStateAndReinitializeTimers",
                    target: "ready",
                  },
                  onError: {
                    target: "ready",
                  },
                },
              },
            },
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
      mergeSyncedStateWithLocalStateAndReinitializeTimers: assign({
        timers: (context, event) => {
          const allLocalTimersContext = [];
          for (const timerRef of context.timers) {
            const timerContext = timerRef.getSnapshot()?.context;
            if (timerContext) {
              allLocalTimersContext.push({ id: timerRef.id, ...timerContext });
            }
          }

          const allSyncedTimersContext = event.data.timers;

          const unionizedTimersContext = unionWith(
            allSyncedTimersContext,
            allLocalTimersContext,
            (a, b) => {
              return a.timerLabel === b.timerLabel;
            },
          );

          return unionizedTimersContext.map((individualTimer) =>
            spawn(
              timerCounterMachine.withContext({
                currentCount: individualTimer.currentCount,
                remainingTimeInSeconds: 0,
                timerLabel: individualTimer.timerLabel,
              }),
              `${individualTimer.id}`,
            ),
          );
        },
      }),
      pushLocalStateToBackend: async (context, event) => {
        const timers = context.timers.map((timerRef) => {
          const timerContext = timerRef.getSnapshot()?.context;
          if (timerContext) {
            return {
              ...timerContext,
              id: timerRef.id,
            };
          }
        });

        console.log(timers);
        await context.backendActor?.upsertUsersSyncedState(
          JSON.stringify(timers),
        );
      },
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
        localStorage.setItem(
          "timerCounterSavedState",
          JSON.stringify(allTimersContext),
        );
      },
      setAuthenticationStateToContext: assign({
        authClient: (context, event) => event.data.authClient,
        backendActor: (context, event) =>
          createActor(canisterId as string | Principal, {
            agentOptions: {
              identity: event.data.authClient.getIdentity(),
            },
          }),
        identity: (context, event) => event.data.authClient.getIdentity(),
      }),
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
      setLoggedInStateToContext: assign({
        backendActor: (context, event) =>
          createActor(canisterId as string | Principal, {
            agentOptions: {
              identity: context.authClient?.getIdentity(),
            },
          }),
        identity: (context, event) => context.authClient?.getIdentity(),
      }),
      setLoggedOutStateToContext: assign({
        backendActor: (context, event) => backend_canister,
        identity: (context, event) => context.authClient?.getIdentity(),
      }),
    },
    guards: {
      isLoggedIn: (context, event) => {
        return event.data.isLoggedIn;
      },
    },
    services: {
      authenticateWithAuthClient: async (context, event) => {
        const authClient = context.authClient;
        await new Promise((resolve, reject) => {
          authClient?.login({
            identityProvider: import.meta.env.VITE_INTERNET_IDENTITY_URL,
            maxTimeToLive: BigInt(29 * 24 * 60 * 60 * 1000 * 1000 * 1000),
            onSuccess: resolve as () => void,
            onError: reject,
          });
        });
      },
      getCurrentUsersSyncedState: async (context) => {
        const syncedState = await context.backendActor?.getUsersSyncedState();

        console.log(syncedState);

        if (syncedState?.length) {
          const [stateToParse] = syncedState;
          return {
            timers: JSON.parse(stateToParse),
          };
        }

        return {
          timers: [],
        };
      },
      loadAuthenticationState: async () => {
        const internetIdentityClient = await AuthClient.create({
          idleOptions: {
            disableIdle: true,
          },
        });

        return {
          isLoggedIn: await internetIdentityClient.isAuthenticated(),
          authClient: internetIdentityClient,
        };
      },
      loadStateFromLocalDB: async () => {
        const timersFromStorage = localStorage.getItem(
          "timerCounterSavedState",
        );

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
