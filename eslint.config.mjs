import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "packages/*/src/**/*.js",
      "packages/*/src/**/*.js.map",
      "packages/*/src/**/*.d.ts",
      "packages/*/src/**/*.d.ts.map",
      ".cache/**",
      ".pnpm-store/**",
      "eslint.config.mjs",
      "packages/brand-tokens/scripts/*.mjs",
      "packages/database/prisma/generated/**",
      "packages/database/prisma/seed.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error"
    }
  }
);
