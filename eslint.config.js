import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["fixtures/**", "**/node_modules/**", "**/dist/**", "**/.next/**"] },
  ...tseslint.configs.recommended,
);
