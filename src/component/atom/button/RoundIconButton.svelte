<script lang="ts">
  export let className: string;
</script>

<button type="button" class={className} on:click>
  <slot />
</button>
