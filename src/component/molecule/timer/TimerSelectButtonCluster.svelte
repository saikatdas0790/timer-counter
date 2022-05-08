<script lang="ts">
  import DurationButton from "$component/atom/button/Duration.svelte";
  import type { TimerSelectButtonProp } from "./_TimerSelectButtonCluster";
  import { createEventDispatcher } from "svelte";
  import { scale } from "svelte/transition";
  import type { Timer } from "src/routes/_index";

  const dispatch = createEventDispatcher();

  export let timer: Timer;

  const possibleValues: TimerSelectButtonProp[] = [
    {
      buttonType: "15min",
      buttonLabel: "15M",
      valueInSeconds: 15 * 60,
    },
    {
      buttonType: "30min",
      buttonLabel: "30M",
      valueInSeconds: 30 * 60,
    },
    {
      buttonType: "1hour",
      buttonLabel: "1H",
      valueInSeconds: 60 * 60,
    },
    {
      buttonType: "2hour",
      buttonLabel: "2H",
      valueInSeconds: 2 * 60 * 60,
    },
  ];
</script>

<div class="flex mt-8 mb-4 justify-around" transition:scale>
  {#each possibleValues as buttonValue (buttonValue.buttonType)}
    <DurationButton
      {buttonValue}
      on:click={() => dispatch("addDuration", { buttonValue, timer })} />
  {/each}
</div>
