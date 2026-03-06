import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import { pwaConfiguration } from "./pwa-configuration.js";

export default defineConfig({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [tailwindcss(), sveltekit(), VitePWA(/** @type {any} */(pwaConfiguration))],
});
