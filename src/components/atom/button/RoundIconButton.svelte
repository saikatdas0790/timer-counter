<script lang="ts">
  export let className = "";
</script>

<button type="button" class={className} on:click>
  <slot />
</button>
