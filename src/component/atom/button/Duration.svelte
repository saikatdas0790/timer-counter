<script lang="ts">
  import type { TimerSelectButtonProp } from "$component/molecule/timer/_TimerSelectButtonCluster";

  export let buttonValue: TimerSelectButtonProp;
</script>

<button
  on:click
  class="text-teal-200 border-2 border-teal-300 rounded-full text-2xl w-20 h-20">
  {buttonValue.buttonLabel}
</button>
