// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.react-router/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Minimal on top of recommended: no-floating-promises and
    // no-misused-promises catch unawaited async work, the failure mode
    // that matters most in transaction and job code (see CLAUDE.md).
    // Both need type info, hence parserOptions.project below.
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
);
