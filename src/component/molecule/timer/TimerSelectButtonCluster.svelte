<script lang="ts">
  import DurationButton from "$component/atom/button/Duration.svelte";
  import { scale } from "svelte/transition";
  import type { ActorRefFrom } from "xstate";
  import {
    timerIntervals,
    type timerCounterMachine,
  } from "./timer-counter/TimerCounter";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

<div class="flex justify-evenly" in:scale>
  {#each timerIntervals as individualInterval (individualInterval.label)}
    <DurationButton
      {individualInterval}
      on:click={() =>
        timer.send({
          type: "TIMER_INTERVAL_SET",
          intervalValue: individualInterval,
        })} />
  {/each}
</div>
