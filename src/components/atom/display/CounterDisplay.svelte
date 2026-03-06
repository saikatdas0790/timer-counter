<script lang="ts">
  import type { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
  import type { ActorRefFrom } from "xstate";
  import { fly } from "svelte/transition";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

{#key $timer.context.currentCount}
  <span
    class="bg-clip-text text-transparent bg-gradient-to-tr from-red-500 to-violet-500 text-8xl font-bold transform -translate-y-2"
    in:fly={{ y: 20, duration: 100 }}
  >
    {$timer.context.currentCount}
  </span>
{/key}
