import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import fs from "fs";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import { pwaConfiguration } from "./pwa-configuration.js";

const isDev = process.env.NODE_ENV === "development";

let canisterIds;
try {
    canisterIds = JSON.parse(
        fs
            .readFileSync(
                isDev ? ".dfx/local/canister_ids.json" : "./canister_ids.json",
            )
            .toString(),
    );
} catch (e) {
    console.error(e);
}

let canisterDefinitions;
try {
    canisterDefinitions = Object.entries(canisterIds).reduce(
        (acc, [key, val]) => ({
            ...acc,
            [`process.env.${key.toUpperCase()}_CANISTER_ID`]: isDev
                ? JSON.stringify(val.local)
                : JSON.stringify(val.ic),
        }),
        {},
    );
} catch (e) {
    console.error(e);
}

let dfxJson;
try {
    dfxJson = JSON.parse(fs.readFileSync("./dfx.json").toString());
} catch (e) {
    console.error(e);
}

const DFX_PORT = dfxJson?.networks?.local?.bind?.split(":")[1];

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), VitePWA(pwaConfiguration)],
    define: {
        ...canisterDefinitions,
        "process.env.NODE_ENV": JSON.stringify(
            isDev ? "development" : "production",
        ),
    },
    server: {
        proxy: {
            // Proxies all /api requests to the local dfx replica
            "/api": {
                target: `http://localhost:${DFX_PORT}`,
            },
        },
    },
});
