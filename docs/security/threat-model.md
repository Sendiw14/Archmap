# Threat model — analyzer and local CLI

Scope: analyzer, CLI, and hosted ingestion (`apps/api`, `apps/worker`, `packages/hosted`). See ADR-0005 for the hosted design.

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

## Hosted ingestion

| Threat                              | Control                                                                                                                                                                    | Verified by                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| SSRF via repository input           | `parseRepositoryInput` allows only `owner/repo` on github.com; outbound requests go to two fixed hosts (`api.github.com`, `codeload.github.com`) with `redirect: "manual"` | `packages/contracts` tests, `apps/api` tests   |
| Private repository access           | Unauthenticated metadata check (`private`/`visibility`) before any download                                                                                                | `apps/api` tests (provider double)             |
| Archive traversal / absolute paths  | tar `preservePaths: false` + explicit containment check                                                                                                                    | `packages/hosted` tests                        |
| Symlink / hard-link escape          | Link entries are never written                                                                                                                                             | `packages/hosted` tests                        |
| Decompression bomb / huge archives  | Streaming byte cap on download (50 MiB); extraction aborts once declared bytes (200 MiB) or entries (100k) exceed budget                                                   | `packages/hosted` tests                        |
| Resource exhaustion during analysis | Child process: heap cap, wall-clock kill (180 s), empty env; container pids/memory/CPU limits; per-file 2 MiB and 10k-file limits                                          | `packages/hosted` timeout test; compose config |
| Repository code execution           | Never installs, builds or imports repository files; syntax-only parsing                                                                                                    | code review; analyzer design                   |
| Unauthorized cancel/delete          | 256-bit capability cookie (HttpOnly, SameSite=Strict, path-scoped), SHA-256 verifier at rest, constant-time compare, same-origin check                                     | `apps/api` tests                               |
| CSRF on create                      | JSON content type required, Origin allow-list                                                                                                                              | `apps/api` tests                               |
| Quota / rate-limit abuse            | 5 new jobs per client per hour, global rate limit, queue-depth cap, safe-disable switch                                                                                    | `apps/api` tests                               |
| Information leakage in errors/logs  | Generic `internal` errors; logs redact cookies/authorization; no source content logged                                                                                     | `apps/api` + `packages/hosted` tests           |
| Insecure artifact access            | Artifacts are private objects served only through the API by unguessable UUID; `noindex`, `no-store`                                                                       | `apps/api` tests                               |
| Stale data retention                | Sweep deletes artifacts at expiry, keeps a 7-day tombstone, then purges                                                                                                    | `packages/hosted` tests                        |
| Secret leakage                      | Config validation names variables only; secrets come from env; worker child gets an empty env                                                                              | code review                                    |
| Dependency / CI compromise          | Lockfile, `pnpm audit`, SHA-pinned actions, `contents: read`                                                                                                               | CI config                                      |

Residual risks: worker egress must be restricted at the network layer in production; anonymous capabilities are bearer tokens (anyone holding the cookie can delete); quotas key on client IP and are weaker behind shared NATs; GitHub may rate-limit the shared API identity.
