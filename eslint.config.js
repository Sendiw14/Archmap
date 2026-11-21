import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["fixtures/**", "**/node_modules/**", "**/dist/**", "**/.next/**", "**/next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
);
