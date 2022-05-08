<script lang="ts">
  import EmptyGrid from "$component/organism/timer-grid/EmptyGrid.svelte";
  import TimersGrid from "$component/organism/timer-grid/TimersGrid.svelte";
  import {
    addEmptyCounterTimerToList,
    setTimeForSpecificTimer,
    type Timer,
  } from "./_index";

  let timers: Timer[] = [];
</script>

<svelte:head>
  <title>Timer Home</title>
</svelte:head>

{#if timers.length === 0}
  <EmptyGrid on:click={() => (timers = addEmptyCounterTimerToList(timers))} />
{:else}
  <TimersGrid
    {timers}
    on:addDuration={({ detail: { timer, buttonValue } }) =>
      (timers = setTimeForSpecificTimer(
        timers,
        timer.id,
        buttonValue.valueInSeconds,
      ))} />
{/if}
