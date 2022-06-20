<script>
  import { Buffer } from "buffer";

  window.global = window;
  window.Buffer = Buffer;
  import "../app.css";
</script>

<svelte:head>
  <link rel="manifest" href="/_app/manifest.webmanifest" />
</svelte:head>

<div class="bg-slate-800 min-h-screen">
  <slot />
</div>
