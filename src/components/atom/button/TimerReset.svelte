<script lang="ts">
  import Reset from "../icon/material-symbols/Close.svelte";
  import { scale } from "svelte/transition";
</script>

<button
  type="button"
  class="inline-flex items-center justify-center p-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-600"
  on:click
  in:scale
>
  <span class="sr-only">Reset timer</span>
  <Reset className="h-20 w-20 text-red-300" />
</button>
