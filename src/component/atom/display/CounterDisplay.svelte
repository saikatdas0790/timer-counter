<script lang="ts">
  import type { timerCounterMachine } from "$component/molecule/timer/timer-counter/TimerCounter";
  import type { ActorRefFrom } from "xstate";
  import { fly } from "svelte/transition";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

{#key $timer.context.currentCount}
  <span
    class="bg-clip-text text-transparent bg-gradient-to-tr from-red-500  to-violet-500 text-9xl font-bold"
    in:fly={{ y: 20, duration: 100 }}>
    {$timer.context.currentCount}
  </span>
{/key}
