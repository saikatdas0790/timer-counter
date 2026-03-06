<script lang="ts">
  import TimerDisplay from "$components/atom/display/TimerDisplay.svelte";
  import Divider from "$components/atom/divider/Divider.svelte";
  import Counter from "$components/molecule/counter/Counter.svelte";
  import type { ActorRefFrom } from "xstate";
  import TimerControllerCluster from "../TimerControllerCluster.svelte";
  import TimerSelectButtonCluster from "../TimerSelectButtonCluster.svelte";
  import type { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
  import TimerLabel from "$components/atom/input/TimerLabel.svelte";
  import RemoveTimer from "$components/atom/button/RemoveTimer.svelte";
  import { readable } from "svelte/store";
  import { onDestroy } from "svelte";
  import TimerWorker from "./TimerWorker.ts?worker";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;

  const snapshot = readable(timer.getSnapshot(), (set) => {
    const sub = timer.subscribe((s) => set(s));
    return sub.unsubscribe;
  });

  const timerWorker = new TimerWorker();

  timerWorker.addEventListener("message", (e) => {
    if (e.data === "ONE_SECOND_ELAPSED")
      timer.send({ type: "ONE_SECOND_ELAPSED" });
  });

  onDestroy(() => {
    timerWorker.terminate();
  });
</script>

<div
  class="border-2 border-blue-100 rounded-lg w-96 shadow shadow-blue-200 flex flex-col justify-between gap-8 duration-500 py-8"
>
  <TimerDisplay {timer} />
  {#if $snapshot.matches("new") || $snapshot.matches("timerSet")}
    <TimerSelectButtonCluster {timer} />
  {/if}
  <TimerControllerCluster {timer} />
  <Divider />
  <Counter {timer} />
  <Divider />
  <TimerLabel
    textToDisplay={$snapshot.context.timerLabel}
    on:input={(e) => {
      timer.send({
        type: "TIMER_COUNTER_LABEL_CHANGED",
        updatedLabel: (e.target as HTMLInputElement)?.value ?? "",
      });
    }}
  />
  <RemoveTimer
    on:click={() => {
      timer.send({ type: "TIMER_COUNTER_DELETED", timerId: timer.id });
    }}
  />
</div>
