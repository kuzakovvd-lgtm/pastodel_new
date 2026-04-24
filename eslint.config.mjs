import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      ".astro/**",
      ".tmp/**",
      "dist/**",
      "**/*.astro",
      "**/*.ts",
      "**/*.tsx",
      "node_modules/**",
      "public/**",
      "src/assets/**",
      "tmp/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
