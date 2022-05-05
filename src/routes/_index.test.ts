import { expect, test } from "vitest";
import { addEmptyCounterTimerToList, type Timer } from "./_index";

test("add new timer counter to an empty list", async () => {
  expect(addEmptyCounterTimerToList([])).toHaveLength(1);
  expect(addEmptyCounterTimerToList([])).toEqual([
    {
      id: 1,
      name: "New Counter",
      timeLeft: 0,
      status: "stopped",
    },
  ]);
});

test("add new timer counter to an existing list", async () => {
  const testTimers: Timer[] = [
    {
      id: 1,
      name: "Counter 1",
      timeLeft: 15,
      status: "running",
    },
    {
      id: 2,
      name: "Counter 2",
      timeLeft: 25,
      status: "stopped",
    },
  ];

  expect(addEmptyCounterTimerToList(testTimers)).toHaveLength(3);
  expect(addEmptyCounterTimerToList(testTimers)).toEqual([
    {
      id: 1,
      name: "Counter 1",
      timeLeft: 15,
      status: "running",
    },
    {
      id: 2,
      name: "Counter 2",
      timeLeft: 25,
      status: "stopped",
    },
    {
      id: 3,
      name: "New Counter",
      timeLeft: 0,
      status: "stopped",
    },
  ]);
});
