# Threat model — analyzer and local CLI

Scope: `packages/*` and `apps/cli`. Hosted ingestion (SSRF, archives, worker isolation, job authorization) is **not yet modelled**; it must be before M5.

| Threat                                                          | Control                                                                                  | Verified by                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| Reading files outside the repo via `../` or absolute specifiers | Resolver host only answers from in-root file set                                         | security test                  |
| Symlink escape                                                  | `lstat`-based walk; symlinks skipped with diagnostic                                     | security test                  |
| `tsconfig` `extends` to outside paths                           | Config reads go through the same root-confined host                                      | security test                  |
| Executing repository code (configs, scripts, plugins)           | Syntax-only parsing; no `require`/`import` of repo files; no child processes in analyzer | code review                    |
| Resource exhaustion (huge files / file counts)                  | `maxFileBytes` (2 MiB), `maxFiles` (10,000)                                              | security test                  |
| Deep recursion on large graphs                                  | Iterative Tarjan                                                                         | 50k-node unit test             |
| Markdown injection in reports                                   | Escape of `                                                                              | \` < >` in interpolated values | partial — needs dedicated test |
| Source leakage                                                  | Evidence stores one statement snippet (≤160 chars), not file contents                    | schema review                  |
| Dependency compromise                                           | Lockfile, `pnpm audit` in CI, SHA-pinned actions, `contents: read`                       | CI config                      |

Residual risks: parser-level DoS on pathological single files below 2 MiB is unbenchmarked; no wall-clock timeout in the local CLI.
