// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextPlugin from "eslint-config-next/core-web-vitals";

// eslint-config-next's own file globs (e.g. "**/*.tsx") are repo-root
// relative, which would pull React/JSX/a11y rules onto packages/core,
// packages/contracts and packages/db too. Rescope every entry that targets
// files to apps/web/app only — the actual React source — not apps/web's own
// plain config files (postcss.config.mjs, next.config.ts): next's base
// config's Babel parser crashes on ESLint 10 (`scopeManager.addGlobals is
// not a function`, a removed context API), and those files are outside
// `app/` anyway, so this scoping sidesteps the crash rather than papering
// over it.
const scopedNextConfig = nextPlugin
  .filter((config) => config.files)
  .map((config) => ({
    ...config,
    files: config.files.map((pattern) => `apps/web/app/${pattern}`),
  }));

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...scopedNextConfig,
  {
    // eslint-config-next ships `settings.react.version: "detect"`, which
    // makes eslint-plugin-react call `context.getFilename()` to sniff the
    // installed React version — a method ESLint 10 removed from the rule
    // context API, crashing every React rule that needs a version (e.g.
    // react/display-name). Pinning the version explicitly skips detection
    // entirely. Bump this string when apps/web's `react` dependency changes.
    files: ["apps/web/app/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    settings: { react: { version: "19.2.8" } },
  },
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
