export type TimerInterval = "15min" | "30min" | "1hour" | "2hour";

export type Timer = {
  id: number;
  timerLabel: string;
  timeLeftInSeconds: number;
  status: "new" | "running" | "finished" | "paused" | "reset";
  currentCount: number;
  currentInterval: TimerInterval;
  runningHistory: {
    interval: TimerInterval;
    startTime: number;
  }[];
};

export const addEmptyCounterTimerToList = (timers: Timer[]) => {
  timers = [
    ...timers,
    {
      id: timers.length + 1,
      timerLabel: "New Counter",
      timeLeftInSeconds: 0,
      status: "new",
      currentCount: 0,
      currentInterval: "15min",
      runningHistory: [],
    },
  ];
  return timers;
};

export const setTimeForSpecificTimer = (
  listOfTimersToUpdate: Timer[],
  timerIdToSet: number,
  valueInSeconds: number,
): Timer[] => {
  const timerToUpdate = listOfTimersToUpdate.find(
    (timer) => timer.id === timerIdToSet,
  );
  if (
    timerToUpdate &&
    (timerToUpdate.status === "new" || timerToUpdate.status === "reset")
  ) {
    timerToUpdate.timeLeftInSeconds = valueInSeconds;
  }
  return listOfTimersToUpdate;
};
