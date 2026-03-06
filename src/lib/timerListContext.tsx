"use client";

import { createActorContext } from "@xstate/react";
import { timerListMachine } from "./timerListMachine";

export const TimerListContext = createActorContext(timerListMachine);
