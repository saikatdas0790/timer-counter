<script lang="ts">
  import PlusCircle from "$component/atom/icon/heroicons/outline/PlusCircle.svelte";
</script>

<button
  on:click
  class="flex flex-col items-center justify-center gap-4 border-2 border-blue-100 rounded-lg w-80 h-80 cursor-pointer text-blue-400  transition-color transition-shadow hover:bg-slate-700 active:bg-slate-900 shadow-md shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 active:shadow active:shadow-blue-200">
  <PlusCircle className="h-20 w-20" />
  <span class="text-3xl font-medium">Add Counter</span>
</button>
