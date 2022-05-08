import type { TimerInterval } from "src/routes/_index";

export type TimerSelectButtonProp = {
  buttonType: TimerInterval;
  buttonLabel: string;
  valueInSeconds: number;
};
