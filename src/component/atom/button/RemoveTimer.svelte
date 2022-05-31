<script lang="ts">
  import Trash from "$component/atom/icon/heroicons/outline/Trash.svelte";
</script>

<button
  class="flex justify-center items-center gap-2 bg-red-700 w-3/4 mx-auto h-16 rounded-xl hover:bg-red-600 active:bg-red-800 transition-colors duration-200"
  on:click>
  <Trash className="h-8 w-8 text-red-200" />
  <span class="text-2xl text-red-200">Remove Timer</span>
</button>
