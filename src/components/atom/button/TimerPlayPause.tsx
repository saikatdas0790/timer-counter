"use client";

import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";
import PauseOutlineRounded from "@/components/atom/icon/material-symbols/PauseOutlineRounded";
import PlayArrowOutlineRounded from "@/components/atom/icon/material-symbols/PlayArrowOutlineRounded";

interface Props {
  timer: ActorRefFrom<typeof timerCounterMachine>;
  onClick: () => void;
}

export default function TimerPlayPause({ timer, onClick }: Props) {
  const snapshot = useSelector(timer, (s) => s);

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-600"
      onClick={onClick}
    >
      <span className="sr-only">Toggle timer start and pause</span>
      <PlayArrowOutlineRounded
        className={`h-24 w-24 text-green-300 ${snapshot.matches("running") ? "hidden" : "block"}`}
      />
      <PauseOutlineRounded
        className={`h-24 w-24 text-yellow-100 ${snapshot.matches("running") ? "block" : "hidden"}`}
      />
    </button>
  );
}
