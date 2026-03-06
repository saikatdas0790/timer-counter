"use client";

import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import {
    timerIntervals,
    type timerCounterMachine,
} from "@/components/molecule/timer/timer-counter/TimerCounter";
import Duration from "@/components/atom/button/Duration";

interface Props {
    timer: ActorRefFrom<typeof timerCounterMachine>;
}

export default function TimerSelectButtonCluster({ timer }: Props) {
    const _snapshot = useSelector(timer, (s) => s);

    return (
        <div className="flex justify-evenly">
            {timerIntervals.map((individualInterval) => (
                <Duration
                    key={individualInterval.label}
                    individualInterval={individualInterval}
                    onClick={() =>
                        timer.send({
                            type: "TIMER_INTERVAL_SET",
                            intervalValue: individualInterval,
                        })
                    }
                />
            ))}
        </div>
    );
}
