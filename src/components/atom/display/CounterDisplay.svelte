<script lang="ts">
  import type { timerCounterMachine } from "$components/molecule/timer/timer-counter/TimerCounter";
  import type { ActorRefFrom } from "xstate";
  import { fly } from "svelte/transition";

  import { readable } from "svelte/store";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;

  const snapshot = readable(timer.getSnapshot(), (set) => {
    const sub = timer.subscribe((s) => set(s));
    return sub.unsubscribe;
  });
</script>

{#key $snapshot.context.currentCount}
  <span
    class="bg-clip-text text-transparent bg-gradient-to-tr from-red-500 to-violet-500 text-8xl font-bold transform -translate-y-2"
    in:fly={{ y: 20, duration: 100 }}
  >
    {$snapshot.context.currentCount}
  </span>
{/key}
