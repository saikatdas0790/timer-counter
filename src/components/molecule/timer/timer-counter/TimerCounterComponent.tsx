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

  return (
    <div className="border-2 border-blue-100 rounded-lg w-96 shadow shadow-blue-200 flex flex-col justify-between gap-8 duration-500 py-8">
      <TimerDisplay timer={timer} />
      {(snapshot.matches("new") || snapshot.matches("timerSet")) && (
        <TimerSelectButtonCluster timer={timer} />
      )}
      <TimerControllerCluster timer={timer} />
      <Divider />
      <Counter timer={timer} />
      <Divider />
      <TimerLabel
        textToDisplay={snapshot.context.timerLabel}
        onCommit={(value) =>
          timer.send({
            type: "TIMER_COUNTER_LABEL_CHANGED",
            updatedLabel: value,
          })
        }
      />
      <RemoveTimer
        onClick={() =>
          timer.send({ type: "TIMER_COUNTER_DELETED", timerId: timer.id })
        }
      />
    </div>
  );
}
