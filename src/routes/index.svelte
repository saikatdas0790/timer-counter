<script lang="ts">
  import AddNewTimerCounter from "$component/molecule/timer/AddNewTimerCounter.svelte";
  import { addEmptyCounterTimerToList, type Timer } from "./_index";

  let timers: Timer[] = [];
</script>

<svelte:head>
  <title>Timer Home</title>
</svelte:head>

{#if timers.length === 0}
  <div class="grid place-items-center min-h-screen">
    <AddNewTimerCounter
      on:click={() => (timers = addEmptyCounterTimerToList(timers))} />
  </div>
{:else}
  <h1>Hello world</h1>
{/if}
