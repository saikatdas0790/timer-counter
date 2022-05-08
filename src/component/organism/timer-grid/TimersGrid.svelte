<script lang="ts">
  import TimerCounter from "$component/molecule/timer/TimerCounter.svelte";
  import type { Timer } from "src/routes/_index";

  export let timers: Timer[];
</script>

{#each timers as timer}
  <TimerCounter {timer} on:addDuration on:playPausePressed on:resetPressed />
{/each}
