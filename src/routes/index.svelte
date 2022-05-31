<script lang="ts">
  import { useMachine } from "@xstate/svelte";
  import EmptyGrid from "$component/organism/timer-grid/EmptyGrid.svelte";
  import TimersGrid from "$component/organism/timer-grid/TimersGrid.svelte";
  import { timerListMachine } from "./_index";
  import TimerSkeletonGrid from "$component/organism/timer-grid/TimerSkeletonGrid.svelte";

  const { state, send } = useMachine(timerListMachine);
</script>

<svelte:head>
  <title>Timer Counter</title>
</svelte:head>

{#if $state.value === "loadingStateFromLocalDB"}
  <TimerSkeletonGrid />
{/if}

{#if $state.value === "ready"}
  {#if $state.context.timers.length === 0}
    <EmptyGrid
      on:click={() => {
        send("NEW_TIMER_COUNTER_CREATED");
      }} />
  {:else}
    <TimersGrid
      timers={$state.context.timers}
      on:newTimerCreated={() => send("NEW_TIMER_COUNTER_CREATED")} />
  {/if}
{/if}
