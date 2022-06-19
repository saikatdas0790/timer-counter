<script>
  import { Buffer } from "buffer";

  window.global = window;
  window.Buffer = Buffer;
  import "../app.css";
</script>

<div class="bg-slate-800 min-h-screen">
  <slot />
</div>
