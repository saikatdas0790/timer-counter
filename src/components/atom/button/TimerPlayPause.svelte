<script lang="ts">
  import type { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
  import type { ActorRefFrom } from "xstate";
  import Pause from "../icon/material-symbols/PauseOutlineRounded.svelte";
  import Play from "../icon/material-symbols/PlayArrowOutlineRounded.svelte";
  import { scale } from "svelte/transition";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

<button
  type="button"
  class="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-600"
  on:click
  in:scale
>
  <span class="sr-only">Toggle timer start and pause</span>
  <Play
    className={`h-24 w-24 text-green-300 ${
      $timer.matches("running") ? "hidden" : "block"
    }`}
  />
  <Pause
    className={`h-24 w-24 text-yellow-100 ${
      $timer.matches("running") ? "block" : "hidden"
    }`}
  />
</button>
