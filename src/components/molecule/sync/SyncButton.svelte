<script lang="ts">
  import RoundIconButton from "$components/atom/button/RoundIconButton.svelte";
  import Sync from "$components/atom/icon/heroicons/outline/Refresh.svelte";
  import { getContext } from "svelte";
  import type { Readable } from "svelte/store";
  import type { Actor, SnapshotFrom } from "xstate";
  import type { timerListMachine } from "$routes/_index";

  const {
    snapshot,
    send,
  }: {
    snapshot: Readable<SnapshotFrom<typeof timerListMachine>>;
    send: Actor<typeof timerListMachine>["send"];
  } = getContext("timerListMachine");
</script>

<RoundIconButton
  on:click={() => {
    if ($snapshot.matches("canisterSync.loggedOut"))
      send({ type: "LOGIN_INITIATED" });
    if ($snapshot.matches("canisterSync.loggedIn.ready"))
      send({ type: "TIMER_COUNTER_SYNCED" });
  }}
>
  <Sync
    className={`!h-12 !w-12 ${
      $snapshot.matches("canisterSync.loggedOut") && "text-red-600"
    } ${$snapshot.matches("canisterSync.loggedIn") && "text-green-600"} ${
      $snapshot.matches("canisterSync.loggedIn.syncInitiated") && "animate-spin"
    }`}
  />
</RoundIconButton>
