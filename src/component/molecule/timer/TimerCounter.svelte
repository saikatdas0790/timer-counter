<script lang="ts">
  import TimerDisplay from "$component/atom/display/TimerDisplay.svelte";
  import type { Timer } from "src/routes/_index";
  import TimerControllerCluster from "./TimerControllerCluster.svelte";
  import TimerSelectButtonCluster from "./TimerSelectButtonCluster.svelte";

  export let timer: Timer;
  // timer.status = "running";
</script>

<div class="border-2 border-blue-100 rounded-lg w-96 shadow shadow-blue-200">
  <TimerDisplay {timer} />
  {#if timer.status === "new" || timer.status === "reset"}
    <TimerSelectButtonCluster {timer} on:addDuration />
  {/if}
  <TimerControllerCluster {timer} on:playPausePressed on:resetPressed />
  <!-- <Divider></Divider> -->
  <!-- <AttachedCounter></AttachedCounter> -->
</div>
