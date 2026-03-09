"use client";

import EmptyGrid from "@/components/organism/timer-grid/EmptyGrid";
import TimersGrid from "@/components/organism/timer-grid/TimersGrid";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";
import { TimerListContext } from "@/lib/timerListContext";
import AuthGate from "@/components/organism/AuthGate";
import { SyncBridge } from "@/components/SyncBridge";
import { AuthLogger } from "@/components/AuthLogger";

function PageContent() {
  const snapshot = TimerListContext.useSelector((s) => s);
  const actorRef = TimerListContext.useActorRef();

  return (
    <>
      {snapshot.matches("loadingStateFromLocalDB") && <TimerSkeletonGrid />}
      {snapshot.matches("ready") &&
        (snapshot.context.timers.length === 0 ? (
          <EmptyGrid
            onNewTimer={() =>
              actorRef.send({ type: "NEW_TIMER_COUNTER_CREATED" })
            }
          />
        ) : (
          <TimersGrid
            timers={snapshot.context.timers}
            onNewTimerCreated={() =>
              actorRef.send({ type: "NEW_TIMER_COUNTER_CREATED" })
            }
          />
        ))}
    </>
  );
}

export default function Home() {
  return (
    <>
      {/* AuthLogger sits outside AuthGate so it captures all auth events,
          including pre-authentication and renewal failures. It is still
          inside OidcProvider (via layout.tsx) so useAuth() works. */}
      <AuthLogger />
      <AuthGate>
        <TimerListContext.Provider>
          <SyncBridge />
          <PageContent />
        </TimerListContext.Provider>
      </AuthGate>
    </>
  );
}
