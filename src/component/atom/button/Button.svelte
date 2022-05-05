<script lang="ts">
  export let className: string;
</script>

<button on:click class={className}>
  <slot />
</button>
