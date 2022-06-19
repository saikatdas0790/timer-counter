<script lang="ts">
  import TimerSkeleton from "$components/molecule/timer/TimerSkeleton.svelte";

  export let timerSkeletonCount = 9;
</script>

<style>
  div {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
    gap: 1rem;
    justify-items: center;
  }
</style>

<div class="py-8">
  {#each Array(timerSkeletonCount)
    .fill(null)
    .map((element, index) => {
      return index + 1;
    }) as skeletonIndex}
    <TimerSkeleton />
  {/each}
</div>
