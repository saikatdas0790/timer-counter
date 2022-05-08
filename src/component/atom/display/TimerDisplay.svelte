<script lang="ts">
  import type { Timer } from "src/routes/_index";

  export let timer: Timer;
</script>

<div class="grid grid-flow-col justify-evenly">
  <div class="flex flex-col justify-center items-center">
    <span class="text-purple-300 text-9xl font-bold">
      {Math.floor(timer.timeLeftInSeconds / 60)}
    </span>
    <span class="text-purple-300 text-2xl">minutes</span>
  </div>
  <div class="flex flex-col justify-center items-center">
    <span class="text-purple-300 text-9xl font-bold">
      {timer.timeLeftInSeconds % 60}
    </span>
    <span class="text-purple-300 text-2xl">seconds</span>
  </div>
</div>
