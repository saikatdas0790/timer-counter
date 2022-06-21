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
  <meta
    name="description"
    content="List of labelled pomodoro timers with attached counters that works offline and syncs betweeen all your devices using Internet Identity and the Internet Computer by Dfinity" />
  <meta property="og:url" content={window.location.href} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Timer Counter" />
  <meta
    property="og:description"
    content="List of labelled pomodoro timers with attached counters that works offline and syncs betweeen all your devices using Internet Identity and the Internet Computer by Dfinity" />
  <meta
    property="og:image"
    content={`${window.location.origin}/assets/logos/logo-square-192.png`} />
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
