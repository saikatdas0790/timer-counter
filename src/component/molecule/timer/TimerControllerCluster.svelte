<script lang="ts">
  import TimerPlayPause from "$component/atom/button/TimerPlayPause.svelte";
  import TimerReset from "$component/atom/button/TimerReset.svelte";
  import type { ActorRefFrom } from "xstate";
  import type { timerCounterMachine } from "./timer-counter/TimerCounter";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

<div class="flex justify-center items-center gap-8">
  {#if $timer.matches("paused") || $timer.matches("running") || $timer.matches("timerSet")}
    <TimerPlayPause
      {timer}
      on:click={() => timer.send("COUNTDOWN_TIMER_PLAY_PAUSED")} />
  {/if}
  {#if $timer.matches("finished") || $timer.matches("paused") || $timer.matches("timerSet")}
    <TimerReset on:click={() => timer.send("COUNTDOWN_TIMER_RESET")} />
  {/if}
</div>
