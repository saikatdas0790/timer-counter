"use client";

import { useEffect, useRef } from "react";
import { useSelector } from "@xstate/react";
import type { ActorRefFrom } from "xstate";
import type { timerCounterMachine } from "@/components/molecule/timer/timer-counter/TimerCounter";
import TimerDisplay from "@/components/atom/display/TimerDisplay";
import Divider from "@/components/atom/divider/Divider";
import Counter from "@/components/molecule/counter/Counter";
import TimerControllerCluster from "@/components/molecule/timer/TimerControllerCluster";
import TimerSelectButtonCluster from "@/components/molecule/timer/TimerSelectButtonCluster";
import TimerLabel from "@/components/atom/input/TimerLabel";
import RemoveTimer from "@/components/atom/button/RemoveTimer";
import { useWakeLock } from "@/lib/useWakeLock";

interface Props {
  timer: ActorRefFrom<typeof timerCounterMachine>;
}

export default function TimerCounter({ timer }: Props) {
  const snapshot = useSelector(timer, (s) => s);
  const workerRef = useRef<Worker | null>(null);

  useWakeLock(snapshot.matches("running"));

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./TimerWorker.ts", import.meta.url),
    );
    workerRef.current.addEventListener("message", (e) => {
      if (
        e.data &&
        typeof e.data === "object" &&
        e.data.type === "SECONDS_ELAPSED"
      ) {
        timer.send({
          type: "SECONDS_ELAPSED",
          seconds: e.data.seconds as number,
        });
      }
    });
    return () => {
      workerRef.current?.terminate();
    };
  }, [timer]);

  // Each card spans exactly 8 parent row-tracks and uses subgrid so all cards
  // in the same visual row share the same track heights. The 8 rows are:
  //   1 TimerDisplay  2 TimerSelectButtonCluster (or placeholder)
  //   3 TimerControllerCluster  4 Divider  5 Counter  6 Divider
  //   7 TimerLabel (textarea — sized to the tallest content across the row)
  //   8 RemoveTimer
  const showSelectCluster =
    snapshot.matches("new") || snapshot.matches("timerSet");

  return (
    <div
      className="border-2 border-blue-100 rounded-lg w-96 shadow shadow-blue-200 duration-500 py-8 grid row-span-8 [grid-template-rows:subgrid]"
    >
      {/* row 1 */}
      <TimerDisplay timer={timer} />
      {/* row 2 — always rendered; invisible placeholder keeps track count
          consistent so rows 3-8 align across all cards */}
      {showSelectCluster
        ? <TimerSelectButtonCluster timer={timer} />
        : <div aria-hidden="true" />}
      {/* row 3 */}
      <TimerControllerCluster timer={timer} />
      {/* row 4 */}
      <Divider />
      {/* row 5 */}
      <Counter timer={timer} />
      {/* row 6 */}
      <Divider />
      {/* row 7 — subgrid row height = tallest textarea content in this row */}
      <TimerLabel
        textToDisplay={snapshot.context.timerLabel}
        onCommit={(value) =>
          timer.send({
            type: "TIMER_COUNTER_LABEL_CHANGED",
            updatedLabel: value,
          })
        }
      />
      {/* row 8 */}
      <RemoveTimer
        onClick={() =>
          timer.send({ type: "TIMER_COUNTER_DELETED", timerId: timer.id })
        }
      />
    </div>
  );
}
