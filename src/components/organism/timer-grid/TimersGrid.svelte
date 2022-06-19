<script lang="ts">
  import AddNewTimerCounter from "$components/molecule/timer/AddNewTimerCounter.svelte";
  import type { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
  import TimerCounter from "$components/molecule/timer/timer-counter/TimerCounter.svelte";
  import type { ActorRefFrom } from "xstate";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let timers: ActorRefFrom<typeof timerCounterMachine>[];
</script>

<style>
  div {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(24rem, 1fr));
    justify-items: center;
    align-items: stretch;
  }
</style>

<div>
  {#each timers as timer}
    <TimerCounter {timer} />
  {/each}
  <AddNewTimerCounter on:click={() => dispatch("newTimerCreated")} />
</div>
