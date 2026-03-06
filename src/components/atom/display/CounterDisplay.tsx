"use client";

import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";

interface Props {
    timer: ActorRefFrom<typeof timerCounterMachine>;
}

export default function CounterDisplay({ timer }: Props) {
    const snapshot = useSelector(timer, (s) => s);

    return (
        <span className="bg-clip-text text-transparent bg-gradient-to-tr from-red-500 to-violet-500 text-8xl font-bold transform -translate-y-2">
            {snapshot.context.currentCount}
        </span>
    );
}
