<script>
  import { Buffer } from "buffer";

  window.global = window;
  window.Buffer = Buffer;
  import "../app.css";

  import { registerSW } from "virtual:pwa-register";

  registerSW({
    onRegistered(swr) {
      console.log(`SW registered: ${swr}`);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });
</script>

<svelte:head>
  <link rel="manifest" href="/_app/manifest.webmanifest" />
</svelte:head>

<div class="bg-slate-800 min-h-screen">
  <slot />
</div>
