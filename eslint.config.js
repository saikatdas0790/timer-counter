import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // global ignores (replaces .eslintignore / --ignore-path)
  {
    ignores: [
      "node_modules",
      "build",
      ".svelte-kit",
      "package",
      "coverage",
      "src/declarations",
      "**/*.typegen.ts",
      "**/*.cjs",
    ],
  },

  // base JS recommended
  js.configs.recommended,

  // TypeScript files
  {
    files: ["**/*.ts", "**/*.js", "**/*.svelte"],
    plugins: { "@typescript-eslint": ts },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2020,
      },
      globals: {
        ...globals.browser,
        ...globals.es2017,
        ...globals.node,
      },
    },
    rules: {
      ...ts.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // TypeScript handles undefined variables; no-undef causes false positives on type imports
      "no-undef": "off",
    },
  },

  // Svelte files — use eslint-plugin-svelte flat config + override parser
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },

  // Prettier must be last to disable conflicting formatting rules
  prettier,
];
