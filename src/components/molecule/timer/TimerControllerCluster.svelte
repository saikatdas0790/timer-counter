<script lang="ts">
  import TimerPlayPause from "$components/atom/button/TimerPlayPause.svelte";
  import TimerReset from "$components/atom/button/TimerReset.svelte";
  import type { ActorRefFrom } from "xstate";
  import type { timerCounterMachine } from "./timer-counter/TimerCounter";

  import { readable } from "svelte/store";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;

  const snapshot = readable(timer.getSnapshot(), (set) => {
    const sub = timer.subscribe((s) => set(s));
    return sub.unsubscribe;
  });
</script>

<div class="flex justify-center items-center gap-8">
  {#if $snapshot.matches("paused") || $snapshot.matches("running") || $snapshot.matches("timerSet")}
    <TimerPlayPause
      {timer}
      on:click={() => timer.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" })}
    />
  {/if}
  {#if $snapshot.matches("finished") || $snapshot.matches("paused") || $snapshot.matches("timerSet")}
    <TimerReset
      on:click={() => timer.send({ type: "COUNTDOWN_TIMER_RESET" })}
    />
  {/if}
</div>
