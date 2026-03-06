import { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
import { assign, createMachine, fromPromise, type ActorRefFrom } from "xstate";
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

type TimerSavedContext = {
  id: string;
  remainingTimeInSeconds: number;
  timerLabel: string;
  currentCount: number;
};

const timerListMachine = createMachine(
  {
    context: (): {
      timers: ActorRefFrom<typeof timerCounterMachine>[];
      authClient?: AuthClient;
      backendActor: ActorSubclass<_SERVICE>;
      identity?: Identity;
      lastSyncedState?: TimerSavedContext[];
    } => ({
      timers: [],
      authClient: undefined,
      backendActor: backend_canister,
      identity: undefined,
      lastSyncedState: undefined,
    }),
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
            on: {
              NEW_TIMER_COUNTER_CREATED: {
                actions: "addNewTimerActorToTimerList",
              },
              TIMER_COUNTER_DELETE_RECEIVED: {
                actions: "removeTimerActorFromTimerList",
              },
              TIMER_COUNTER_STATE_CHANGED: {
                actions: "saveTimersListStateToLocalStorage",
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
                  guard: "isLoggedIn",
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
              input: ({
                context,
              }: {
                context: { authClient?: AuthClient };
              }) => ({
                authClient: context.authClient,
              }),
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
                on: {
                  TIMER_COUNTER_SYNCED: {
                    target: "syncInitiated",
                  },
                  TIMER_COUNTER_STATE_CHANGED: {
                    actions: "pushLocalStateToBackend",
                  },
                },
              },
              syncInitiated: {
                invoke: {
                  src: "getCurrentUsersSyncedState",
                  input: ({
                    context,
                  }: {
                    context: { backendActor: ActorSubclass<_SERVICE> };
                  }) => ({
                    backendActor: context.backendActor,
                  }),
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
        timers: ({ context, spawn }) => {
          return [
            ...context.timers,
            spawn(timerCounterMachine, {
              id: `${Date.now()}`,
            }),
          ];
        },
      }),
      mergeSyncedStateWithLocalStateAndReinitializeTimers: assign({
        timers: ({ context, event, spawn }) => {
          const allLocalTimersContext: TimerSavedContext[] = [];
          for (const timerRef of context.timers) {
            const timerContext = timerRef.getSnapshot()?.context;
            if (timerContext) {
              allLocalTimersContext.push({ id: timerRef.id, ...timerContext });
            }
          }

          const output = (event as { output: { timers: TimerSavedContext[] } })
            .output;
          const allSyncedTimersContext = output.timers;

          const unionizedTimersContext = unionWith(
            allSyncedTimersContext,
            allLocalTimersContext,
            (a, b) => {
              return a.timerLabel === b.timerLabel;
            },
          );

          return unionizedTimersContext.map((individualTimer) =>
            spawn(timerCounterMachine, {
              id: `${individualTimer.id}`,
              input: {
                currentCount: individualTimer.currentCount,
                remainingTimeInSeconds: 0,
                timerLabel: individualTimer.timerLabel,
              },
            }),
          );
        },
      }),
      pushLocalStateToBackend: async ({ context }) => {
        const timers = context.timers.map((timerRef) => {
          const timerContext = timerRef.getSnapshot()?.context;
          if (timerContext) {
            return {
              ...timerContext,
              id: timerRef.id,
            };
          }
        });

        await context.backendActor?.upsertUsersSyncedState(
          JSON.stringify(timers),
        );
      },
      removeTimerActorFromTimerList: assign({
        timers: ({ context, event }) => {
          const e = event as {
            type: "TIMER_COUNTER_DELETE_RECEIVED";
            timerId: string;
          };
          return context.timers.filter((timer) => timer.id !== e.timerId);
        },
      }),
      saveTimersListStateToLocalStorage: async ({ context }) => {
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
      setAuthenticationStateToContext: assign(({ event }) => {
        const output = (
          event as {
            output: { isLoggedIn: boolean; authClient: AuthClient };
          }
        ).output;
        return {
          authClient: output.authClient,
          backendActor: createActor(canisterId as string | Principal, {
            agentOptions: {
              identity: output.authClient.getIdentity(),
            },
          }),
          identity: output.authClient.getIdentity(),
        };
      }),
      setLoadedTimerDataToContext: assign({
        timers: ({ event, spawn }) => {
          const output = (event as { output: { timers: TimerSavedContext[] } })
            .output;
          return output.timers.map((individualTimer) =>
            spawn(timerCounterMachine, {
              id: `${individualTimer.id}`,
              input: {
                currentCount: individualTimer.currentCount,
                remainingTimeInSeconds: 0,
                timerLabel: individualTimer.timerLabel,
              },
            }),
          );
        },
      }),
      setLoggedInStateToContext: assign(({ context }) => ({
        backendActor: createActor(canisterId as string | Principal, {
          agentOptions: {
            identity: context.authClient?.getIdentity(),
          },
        }),
        identity: context.authClient?.getIdentity(),
      })),
      setLoggedOutStateToContext: assign(() => ({
        backendActor: backend_canister,
      })),
    },
    guards: {
      isLoggedIn: ({ event }) => {
        const output = (event as { output: { isLoggedIn: boolean } }).output;
        return output.isLoggedIn;
      },
    },
    actors: {
      authenticateWithAuthClient: fromPromise(
        async ({ input }: { input: { authClient?: AuthClient } }) => {
          const authClient = input.authClient;
          await new Promise<void>((resolve, reject) => {
            authClient?.login({
              identityProvider: import.meta.env.VITE_INTERNET_IDENTITY_URL,
              maxTimeToLive: BigInt(29 * 24 * 60 * 60 * 1000 * 1000 * 1000),
              onSuccess: resolve,
              onError: reject,
            });
          });
        },
      ),
      getCurrentUsersSyncedState: fromPromise(
        async ({
          input,
        }: {
          input: { backendActor: ActorSubclass<_SERVICE> };
        }) => {
          const syncedState = await input.backendActor?.getUsersSyncedState();

          if (syncedState?.length) {
            const [stateToParse] = syncedState;
            return {
              timers: JSON.parse(stateToParse) as TimerSavedContext[],
            };
          }

          return {
            timers: [] as TimerSavedContext[],
          };
        },
      ),
      loadAuthenticationState: fromPromise(async () => {
        const internetIdentityClient = await AuthClient.create({
          idleOptions: {
            disableIdle: true,
          },
        });

        return {
          isLoggedIn: await internetIdentityClient.isAuthenticated(),
          authClient: internetIdentityClient,
        };
      }),
      loadStateFromLocalDB: fromPromise(async () => {
        const timersFromStorage = localStorage.getItem(
          "timerCounterSavedState",
        );

        if (timersFromStorage) {
          return {
            timers: JSON.parse(timersFromStorage) as TimerSavedContext[],
          };
        } else {
          localStorage.setItem("timerCounterSavedState", JSON.stringify([]));
          return {
            timers: [] as TimerSavedContext[],
          };
        }
      }),
    },
  },
);

export { timerListMachine };
