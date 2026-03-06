"use client";

import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";
import TimerCounterComponent from "@/components/molecule/timer/timer-counter/TimerCounterComponent";
import AddNewTimerCounter from "@/components/molecule/timer/AddNewTimerCounter";

interface Props {
    timers: ActorRefFrom<typeof timerCounterMachine>[];
    onNewTimerCreated: () => void;
}

export default function TimersGrid({ timers, onNewTimerCreated }: Props) {
    return (
        <div
            style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fill, minmax(24rem, 1fr))",
                justifyItems: "center",
                alignItems: "stretch",
            }}
        >
            {timers.map((timer) => (
                <TimerCounterComponent key={timer.id} timer={timer} />
            ))}
            <AddNewTimerCounter onNewTimer={onNewTimerCreated} />
        </div>
    );
}
