<script lang="ts">
  import type { ActorRefFrom } from "xstate";
  import type { timerCounterMachine } from "$component/molecule/timer/timer-counter/TimerCounter";
  import CounterModify from "$component/atom/button/RoundIconButton.svelte";
  import Minus from "$component/atom/icon/heroicons/outline/Minus.svelte";
  import Plus from "$component/atom/icon/heroicons/outline/Plus.svelte";
  import CounterDisplay from "$component/atom/display/CounterDisplay.svelte";

  export let timer: ActorRefFrom<typeof timerCounterMachine>;
</script>

<div class="flex justify-center items-center gap-4">
  <CounterModify
    className="inline-flex items-center justify-center p-4 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-600"
    on:click={() => timer.send("TIMER_COUNTER_DECREMENTED")}>
    <span class="sr-only">Decrement counter by 1</span>
    <Minus className="h-12 w-12 text-red-500" />
  </CounterModify>

  <CounterDisplay {timer} />

  <CounterModify
    className="inline-flex items-center justify-center p-4 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-600"
    on:click={() => timer.send("TIMER_COUNTER_INCREMENTED")}>
    <span class="sr-only">Increment counter by 1</span>
    <Plus className="h-12 w-12 text-purple-500" />
  </CounterModify>
</div>
