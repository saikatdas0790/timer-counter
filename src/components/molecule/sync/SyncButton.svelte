<script lang="ts">
  import RoundIconButton from "$components/atom/button/RoundIconButton.svelte";
  import Sync from "$components/atom/icon/heroicons/outline/Refresh.svelte";
  import { matches } from "lodash";
  import type { timerListMachine } from "src/routes/_index";
  import { getContext } from "svelte";
  import type { Readable } from "svelte/store";
  import type { InterpreterFrom, StateFrom } from "xstate";

  const {
    state,
    send,
  }: {
    state: Readable<StateFrom<typeof timerListMachine>>;
    send: InterpreterFrom<typeof timerListMachine>["send"];
  } = getContext("timerListMachine");
</script>

<RoundIconButton
  on:click={() => {
    if ($state.matches("canisterSync.loggedOut")) send("LOGIN_INITIATED");
    if ($state.matches("canisterSync.loggedIn.ready"))
      send("TIMER_COUNTER_SYNCED");
  }}>
  <Sync
    className={`!h-12 !w-12 ${
      $state.matches("canisterSync.loggedOut") && "text-red-600"
    } ${$state.matches("canisterSync.loggedIn") && "text-green-600"} ${
      $state.matches("canisterSync.loggedIn.syncInitiated") && "animate-spin"
    }`} />
</RoundIconButton>
