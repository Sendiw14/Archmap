# Analysis coverage matrix

| Construct                                                                             | Supported                                                 | Edge kind / class        | Fixture                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ | ------------------------------ |
| `import x from` / named / namespace / side-effect                                     | Yes                                                       | import / runtime         | esm                            |
| `.js` specifier resolving to `.ts`                                                    | Yes                                                       | import                   | esm                            |
| JSON import                                                                           | Yes                                                       | import → json node       | esm                            |
| `export * from`, `export {x} from`, `export * as ns from`                             | Yes                                                       | export / runtime         | reexports, barrel              |
| `import type`, all-type named imports, `export type {} from`                          | Yes                                                       | type-only                | type-only                      |
| `typeof import("x")`                                                                  | Yes                                                       | import-type / type-only  | type-only                      |
| `require("x")` literal / template without substitutions                               | Yes                                                       | require / runtime        | commonjs                       |
| `import x = require("x")`                                                             | Yes                                                       | require                  | commonjs                       |
| `import("x")` literal                                                                 | Yes                                                       | dynamic-import / runtime | dynamic-import                 |
| `require(expr)`, `import(expr)`                                                       | No — diagnostic `unsupported-expression`                  | —                        | unsupported-expressions        |
| tsconfig `paths`, `baseUrl`, relative `extends`                                       | Yes                                                       |                          | path-alias, project-references |
| `extends` from a package in node_modules                                              | No — `config-error`                                       |                          | —                              |
| package.json `exports` / `imports`                                                    | Yes (TypeScript semantics)                                |                          | package-exports                |
| Workspace packages (by package.json `name`)                                           | Yes, incl. source fallback                                |                          | monorepo                       |
| Project references                                                                    | Yes (nearest config per file)                             |                          | project-references             |
| Case-mismatched specifiers                                                            | Unresolved on every OS                                    |                          | case-sensitive                 |
| Syntax errors                                                                         | Partial: references from recoverable tree + `parse-error` |                          | malformed                      |
| Symlinks                                                                              | Not followed — `symlink-skipped`                          |                          | security test                  |
| Vue/Svelte/Astro SFCs, CSS/asset imports, webpack aliases, framework file conventions | No                                                        |                          | —                              |
| Symbol-level (which names are imported)                                               | No (file-level only in v1 baseline)                       |                          | —                              |

Default ignored directories: node_modules, .git, dist, build, out, coverage, .next, .turbo, .cache, .vercel.
