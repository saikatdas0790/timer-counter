"use client";

import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";
import TimerPlayPause from "@/components/atom/button/TimerPlayPause";
import TimerReset from "@/components/atom/button/TimerReset";

interface Props {
    timer: ActorRefFrom<typeof timerCounterMachine>;
}

export default function TimerControllerCluster({ timer }: Props) {
    const snapshot = useSelector(timer, (s) => s);

    return (
        <div className="flex justify-center items-center gap-8">
            {(snapshot.matches("paused") ||
                snapshot.matches("running") ||
                snapshot.matches("timerSet")) && (
                    <TimerPlayPause
                        timer={timer}
                        onClick={() => timer.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" })}
                    />
                )}
            {(snapshot.matches("finished") ||
                snapshot.matches("paused") ||
                snapshot.matches("timerSet")) && (
                    <TimerReset
                        onClick={() => timer.send({ type: "COUNTDOWN_TIMER_RESET" })}
                    />
                )}
        </div>
    );
}
