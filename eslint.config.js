import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "fixtures/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "apps/web/test-results/**",
      "apps/web/playwright-report/**",
    ],
  },
  ...tseslint.configs.recommended,
);
