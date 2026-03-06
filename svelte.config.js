import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";
import path from "path";

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
    adapter: adapter({ fallback: "index.html" }),
    alias: {
      $canisters: path.resolve("./src/declarations"),
      $components: path.resolve("./src/components"),
      $routes: path.resolve("./src/routes"),
    },
  },
};

export default config;
