import { copyFileSync, existsSync } from "fs";
import { resolveConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { pwaConfiguration } from "./pwa-configuration.js";

const webmanifestSource = "./.svelte-kit/output/client/manifest.webmanifest";
const webmanifestDestinations = ["./build"];

const swSource = "./.svelte-kit/output/client/sw.js";
const swDestinations = ["./build/"];

const buildPwa = async () => {
  const config = await resolveConfig(
    { plugins: [VitePWA({ ...pwaConfiguration })] },
    "build",
    "production",
  );
  // when `vite-plugin-pwa` is present, use it to regenerate SW after rendering
  const pwaPlugin = config.plugins.find(
    (i) => i.name === "vite-plugin-pwa",
  )?.api;
  if (pwaPlugin?.generateSW) {
    console.log("Generating PWA...");
    await pwaPlugin.generateSW();
    if (existsSync(webmanifestSource)) {
      webmanifestDestinations.forEach((d) => {
        copyFileSync(webmanifestSource, `${d}/manifest.webmanifest`);
      });
    }
    // don't copy workbox, SvelteKit will copy it
    if (existsSync(swSource)) {
      swDestinations.forEach((d) => {
        copyFileSync(swSource, `${d}/sw.js`);
      });
    }
    console.log("Generation of PWA complete");
  }
};

buildPwa();
