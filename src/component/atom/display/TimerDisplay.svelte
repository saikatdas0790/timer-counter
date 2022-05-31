<script lang="ts">
  import type { timerCounterMachine } from "$component/molecule/timer/timer-counter/TimerCounter";
  import type { ActorRefFrom } from "xstate";
  import { fly } from "svelte/transition";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
  $: minutes = Math.floor($timer.context.remainingTimeInSeconds / 60);
  $: seconds = $timer.context.remainingTimeInSeconds % 60;
</script>

<div class="grid grid-flow-col justify-evenly">
  <div class="flex flex-col justify-center items-center">
    {#key minutes}
      <span
        class="text-purple-300 text-9xl font-bold"
        in:fly={{ y: 20, duration: 100 }}>
        {minutes}
      </span>
    {/key}
    <span class="text-purple-300 text-2xl">minutes</span>
  </div>
  <div class="flex flex-col justify-center items-center">
    {#key seconds}
      <span
        class="text-purple-300 text-9xl font-bold"
        in:fly={{ y: 20, duration: 100 }}>
        {seconds}
      </span>
    {/key}
    <span class="text-purple-300 text-2xl">seconds</span>
  </div>
</div>
