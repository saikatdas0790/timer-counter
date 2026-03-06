<script lang="ts">
  import ChevronLeft from "$components/atom/icon/heroicons/outline/ChevronLeft.svelte";
  import SyncButton from "$components/molecule/sync/SyncButton.svelte";

  let isPeekOpen = false;
</script>

<div
  class="fixed z-10 bottom-12 right-0 flex gap-4 bg-slate-700 p-4 rounded-l-2xl transition-transform shadow shadow-fuchsia-400"
  class:translate-x-16={!isPeekOpen}
>
  <button
    class="transition-transform"
    class:rotate-180={isPeekOpen}
    on:click={() => (isPeekOpen = !isPeekOpen)}
  >
    <ChevronLeft className="text-white !h-12 !w-12" />
  </button>
  <SyncButton />
</div>
