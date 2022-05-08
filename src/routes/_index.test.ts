import { expect, test } from "vitest";
import {
  addEmptyCounterTimerToList,
  setTimeForSpecificTimer,
  type Timer,
} from "./_index";

test("add new timer counter to an empty list", async () => {
  expect(addEmptyCounterTimerToList([])).toHaveLength(1);
  expect(addEmptyCounterTimerToList([])).toEqual([
    {
      id: 1,
      timerLabel: "New Counter",
      timeLeftInSeconds: 0,
      status: "new",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [],
    },
  ]);
});

test("add new timer counter to an existing list", async () => {
  const testTimers: Timer[] = [
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15,
      status: "running",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 25,
      status: "finished",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
  ];

  expect(addEmptyCounterTimerToList(testTimers)).toHaveLength(3);
  expect(addEmptyCounterTimerToList(testTimers)).toEqual([
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15,
      status: "running",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 25,
      status: "finished",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
    {
      id: 3,
      timerLabel: "New Counter",
      timeLeftInSeconds: 0,
      status: "new",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [],
    },
  ]);
});

test("set time for a specific timer", async () => {
  const testTimersWithoutNewOrReset: Timer[] = [
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15,
      status: "running",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 25,
      status: "finished",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
  ];

  expect(
    setTimeForSpecificTimer(testTimersWithoutNewOrReset, 1, 15 * 60),
  ).toEqual([
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15,
      status: "running",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 25,
      status: "finished",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
  ]);

  const testTimersWithNewAndReset: Timer[] = [
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15,
      status: "new",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 25,
      status: "reset",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
  ];

  expect(
    setTimeForSpecificTimer(testTimersWithNewAndReset, 1, 15 * 60),
  ).toEqual([
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15 * 60,
      status: "new",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 25,
      status: "reset",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
  ]);

  expect(
    setTimeForSpecificTimer(testTimersWithNewAndReset, 2, 60 * 60),
  ).toEqual([
    {
      id: 1,
      timerLabel: "Counter 1",
      timeLeftInSeconds: 15 * 60,
      status: "new",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [{ interval: "15min", startTime: 0 }],
    },
    {
      id: 2,
      timerLabel: "Counter 2",
      timeLeftInSeconds: 60 * 60,
      status: "reset",
      currentCount: 5,
      currentInterval: "30min",
      runningHistory: [
        { interval: "30min", startTime: 0 },
        { interval: "15min", startTime: 0 },
      ],
    },
  ]);
});
