<script lang="ts">
  import type { TimerInterval } from "$components/molecule/timer/timer-counter/TimerCounter";

  export let individualInterval: TimerInterval;
</script>

<button
  on:click
  class="text-teal-200 border-2 border-teal-300 rounded-full text-2xl w-20 h-20">
  {individualInterval.label}
</button>
