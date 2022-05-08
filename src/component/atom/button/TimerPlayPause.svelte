<script lang="ts">
  import Pause from "../icon/material-symbols/PauseOutlineRounded.svelte";
  import Play from "../icon/material-symbols/PlayArrowOutlineRounded.svelte";
  import type { Timer } from "src/routes/_index";

  export let timer: Timer;
</script>

<button
  type="button"
  class="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
  on:click>
  <span class="sr-only">Toggle timer start and pause</span>
  <Play
    className={`h-24 w-24 text-green-300 ${
      timer.status === "running" ? "hidden" : "block"
    }`} />
  <Pause
    className={`h-24 w-24 text-yellow-100 ${
      timer.status === "running" ? "block" : "hidden"
    }`} />
</button>
