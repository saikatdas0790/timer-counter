"use client";

import EmptyGrid from "@/components/organism/timer-grid/EmptyGrid";
import TimersGrid from "@/components/organism/timer-grid/TimersGrid";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";
import { TimerListContext } from "@/lib/timerListContext";

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
        <TimerListContext.Provider>
            <PageContent />
        </TimerListContext.Provider>
    );
}
