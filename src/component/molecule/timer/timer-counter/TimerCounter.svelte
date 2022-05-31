<script lang="ts">
  import TimerDisplay from "$component/atom/display/TimerDisplay.svelte";
  import Divider from "$component/atom/divider/Divider.svelte";
  import Counter from "$component/molecule/counter/Counter.svelte";
  import type { ActorRefFrom } from "xstate";
  import TimerControllerCluster from "../TimerControllerCluster.svelte";
  import TimerSelectButtonCluster from "../TimerSelectButtonCluster.svelte";
  import type { timerCounterMachine } from "$component/molecule/timer/timer-counter/TimerCounter";
  import TimerLabel from "$component/atom/input/TimerLabel.svelte";
  import RemoveTimer from "$component/atom/button/RemoveTimer.svelte";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

<div
  class="border-2 border-blue-100 rounded-lg w-96 shadow shadow-blue-200 flex flex-col justify-between gap-8 duration-500 py-8">
  <TimerDisplay {timer} />
  {#if $timer.matches("new") || $timer.matches("timerSet")}
    <TimerSelectButtonCluster {timer} />
  {/if}
  <TimerControllerCluster {timer} />
  <Divider />
  <Counter {timer} />
  <Divider />
  <TimerLabel
    textToDisplay={$timer.context.timerLabel}
    on:input={(e) => {
      console.log(e);
      timer.send({
        type: "TIMER_COUNTER_LABEL_CHANGED",
        // @ts-ignore
        updatedLabel: e.target?.value ?? "",
      });
    }} />
  <RemoveTimer
    on:click={() => {
      timer.send({ type: "TIMER_COUNTER_DELETED", timerId: timer.id });
    }} />
</div>
