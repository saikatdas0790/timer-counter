export type Timer = {
  id: number;
  name: string;
  timeLeft: number;
  status: "running" | "stopped";
};

export const addEmptyCounterTimerToList = (timers: Timer[]) => {
  timers = [
    ...timers,
    {
      id: timers.length + 1,
      name: "New Counter",
      timeLeft: 0,
      status: "stopped",
    },
  ];
  return timers;
};
