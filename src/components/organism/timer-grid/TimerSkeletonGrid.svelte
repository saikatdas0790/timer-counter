<script lang="ts">
  import TimerSkeleton from "$components/molecule/timer/TimerSkeleton.svelte";

  export let timerSkeletonCount = 9;
</script>

<div class="py-8">
  {#each Array(timerSkeletonCount).fill(null) as _item, i (i)}
    <TimerSkeleton />
  {/each}
</div>

<style>
  div {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
    gap: 1rem;
    justify-items: center;
  }
</style>
