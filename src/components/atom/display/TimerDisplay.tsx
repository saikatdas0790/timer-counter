"use client";

import { useEffect } from "react";
import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";

interface Props {
  timer: ActorRefFrom<typeof timerCounterMachine>;
}

export default function TimerDisplay({ timer }: Props) {
  const snapshot = useSelector(timer, (s) => s);
  const minutes = Math.floor(snapshot.context.remainingTimeInSeconds / 60);
  const seconds = snapshot.context.remainingTimeInSeconds % 60;

  useEffect(() => {
    if (snapshot.matches("running")) {
      document.title = `${minutes}:${String(seconds).padStart(2, "0")}`;
    } else {
      document.title = "Timer Counter";
    }
  }, [snapshot, minutes, seconds]);

  return (
    <div className="grid grid-flow-col justify-evenly">
      <div className="flex flex-col justify-center items-center">
        <span className="text-purple-300 text-9xl font-bold">{minutes}</span>
        <span className="text-purple-300 text-2xl">minutes</span>
      </div>
      <div className="flex flex-col justify-center items-center">
        <span className="text-purple-300 text-9xl font-bold">{seconds}</span>
        <span className="text-purple-300 text-2xl">seconds</span>
      </div>
    </div>
  );
}
