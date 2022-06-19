<script lang="ts">
  import { useMachine } from "@xstate/svelte";
  import EmptyGrid from "$components/organism/timer-grid/EmptyGrid.svelte";
  import TimersGrid from "$components/organism/timer-grid/TimersGrid.svelte";
  import { timerListMachine } from "./_index";
  import TimerSkeletonGrid from "$components/organism/timer-grid/TimerSkeletonGrid.svelte";
  import PeekingControls from "$components/organism/PeekingControls.svelte";
  import { setContext } from "svelte";

  const { state, send } = useMachine(timerListMachine);

  setContext("timerListMachine", { state, send });
</script>

<svelte:head>
  <title>Timer Counter</title>
</svelte:head>

{#if $state.matches("timerList.loadingStateFromLocalDB")}
  <TimerSkeletonGrid />
{/if}

{#if $state.matches("timerList.ready")}
  <PeekingControls />
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
