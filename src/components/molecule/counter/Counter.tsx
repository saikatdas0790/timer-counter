"use client";

import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";
import RoundIconButton from "@/components/atom/button/RoundIconButton";
import Minus from "@/components/atom/icon/heroicons/outline/Minus";
import Plus from "@/components/atom/icon/heroicons/outline/Plus";
import CounterDisplay from "@/components/atom/display/CounterDisplay";

interface Props {
  timer: ActorRefFrom<typeof timerCounterMachine>;
}

export default function Counter({ timer }: Props) {
  const _snapshot = useSelector(timer, (s) => s);

  return (
    <div className="flex justify-center items-center gap-4">
      <RoundIconButton
        className="inline-flex items-center justify-center p-4 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-600"
        onClick={() => timer.send({ type: "TIMER_COUNTER_DECREMENTED" })}
      >
        <span className="sr-only">Decrement counter by 1</span>
        <Minus className="h-10 w-10 text-red-500" />
      </RoundIconButton>

      <CounterDisplay timer={timer} />

      <RoundIconButton
        className="inline-flex items-center justify-center p-4 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-600"
        onClick={() => timer.send({ type: "TIMER_COUNTER_INCREMENTED" })}
      >
        <span className="sr-only">Increment counter by 1</span>
        <Plus className="h-10 w-10 text-purple-500" />
      </RoundIconButton>
    </div>
  );
}
