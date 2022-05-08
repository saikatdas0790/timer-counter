<script lang="ts">
  import TimerPlayPause from "$component/atom/button/TimerPlayPause.svelte";
  import TimerReset from "$component/atom/button/TimerReset.svelte";
  import type { Timer } from "src/routes/_index";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let timer: Timer;
</script>

<div class="flex justify-center items-center">
  {#if timer.status !== "finished"}
    <TimerPlayPause
      {timer}
      on:click={() => dispatch("playPausePressed", timer)} />
  {/if}
  {#if timer.status === "finished" || timer.status === "paused"}
    <TimerReset on:click={() => dispatch("resetPressed", timer)} />
  {/if}
</div>
