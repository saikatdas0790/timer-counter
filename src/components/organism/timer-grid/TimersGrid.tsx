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
        columnGap: "1rem",
        // rowGap is the gap between every sub-row across ALL cards — must match
        // the old gap-8 (2 rem) spacing between sections inside each card.
        rowGap: "2rem",
        gridTemplateColumns: "repeat(auto-fill, minmax(24rem, 1fr))",
        justifyItems: "center",
      }}
    >
      {timers.map((timer) => (
        <TimerCounterComponent key={timer.id} timer={timer} />
      ))}
      {/* Wrap in a row-span-8 container so the Add button participates in
          the same 8-track subgrid layout as the timer cards. */}
      <div className="row-span-8 w-96">
        <AddNewTimerCounter onNewTimer={onNewTimerCreated} />
      </div>
    </div>
  );
}
