import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next: it ignores build/**, which here holds source (Vite worker build), not output.
  globalIgnores([
    "!build/**",
    ".next/**",
    "out/**",
    "dist/**",
    "tmp/**",
    "vendor/**",
    ".local-backups/**",
    ".wrangler/**",
    // Worktrees of other sessions: copies of the repo, linted in their own checkout
    ".claude/**",
    "next-env.d.ts",
  ]),
  {
    // Leaving fields out by destructuring ({a, ...rest}) and names starting with _ are deliberate.
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Backend and tooling: no React here (useDocumentStore is a plain function, not a hook).
    files: ["{server,shared,scripts,build,tests,drizzle,drizzle-accounts}/**/*.{ts,mjs,js}", "middleware.ts", "app/api/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // Plain JavaScript has no type checker (checkJs is off): the core rules that catch real mistakes.
    files: ["**/*.{mjs,js}"],
    rules: {
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-dupe-else-if": "error",
      "no-dupe-class-members": "error",
      "no-unreachable": "error",
      "no-const-assign": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-class-assign": "error",
      "no-ex-assign": "error",
      "no-global-assign": "error",
      "no-redeclare": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "no-constant-binary-expression": "error",
      "no-async-promise-executor": "error",
      "no-setter-return": "error",
      "no-obj-calls": "error",
      "no-invalid-regexp": "error",
      "no-empty-character-class": "error",
      "no-useless-backreference": "error",
      "no-loss-of-precision": "error",
      "no-compare-neg-zero": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "getter-return": "error",
      "for-direction": "error",
      "require-yield": "error",
    },
  },
]);

export default eslintConfig;
