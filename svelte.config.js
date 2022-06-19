import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";
import path from "path";
import fs from "fs";

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
} catch (e) {}

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
} catch (error) {}

let dfxJson;
try {
  dfxJson = JSON.parse(fs.readFileSync("./dfx.json").toString());
} catch (e) {}

const DFX_PORT = dfxJson.networks.local.bind.split(":")[1];

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    preprocess({
      postcss: true,
    }),
  ],

  kit: {
    adapter: adapter(),
    alias: {
      $canisters: path.resolve("./src/declarations"),
      $components: path.resolve("./src/components"),
      $routes: path.resolve("./src/routes"),
    },
    vite: {
      define: {
        ...canisterDefinitions,
        "process.env.NODE_ENV": JSON.stringify(
          isDev ? "development" : "production",
        ),
      },
      server: {
        proxy: {
          // This proxies all http requests made to /api to our running dfx instance
          "/api": {
            target: `http://localhost:${DFX_PORT}`,
          },
        },
      },
    },
  },
};

export default config;
