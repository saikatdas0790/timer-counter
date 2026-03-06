<script lang="ts">
  import { useMachine } from "@xstate/svelte";
  import EmptyGrid from "$components/organism/timer-grid/EmptyGrid.svelte";
  import TimersGrid from "$components/organism/timer-grid/TimersGrid.svelte";
  import { timerListMachine } from "./_index";
  import TimerSkeletonGrid from "$components/organism/timer-grid/TimerSkeletonGrid.svelte";
  import { setContext } from "svelte";

  const { snapshot, send } = useMachine(timerListMachine);

  setContext("timerListMachine", { snapshot, send });
</script>

<svelte:head>
  <title>Timer Counter</title>
  <meta
    name="description"
    content="Labelled pomodoro timers with attached counters"
  />
</svelte:head>

{#if $snapshot.matches("loadingStateFromLocalDB")}
  <TimerSkeletonGrid />
{/if}

{#if $snapshot.matches("ready")}
  {#if $snapshot.context.timers.length === 0}
    <EmptyGrid
      on:click={() => {
        send({ type: "NEW_TIMER_COUNTER_CREATED" });
      }}
    />
  {:else}
    <TimersGrid
      timers={$snapshot.context.timers}
      on:newTimerCreated={() => send({ type: "NEW_TIMER_COUNTER_CREATED" })}
    />
  {/if}
{/if}
