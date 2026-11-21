# ADR-0005: Hosted ingestion architecture

Status: Accepted (2026-11-21)

**Context.** Spec §7–8: public GitHub imports, async jobs, isolated workers, Postgres + Redis/BullMQ + S3, 24 h retention, anonymous management capability.

**Decision.**

- `packages/contracts`: zod API contract, error codes, job state machine; OpenAPI generated from it (`pnpm openapi`).
- `packages/hosted`: ports (`AnalysisStore`, `ArtifactStore`, `JobQueue`, `SourceProvider`) with production adapters (Postgres/Drizzle, S3, BullMQ, GitHub) and in-memory adapters (offline mode, tests). The pipeline lives here so the API's offline "memory" mode runs the same code as the worker.
- `apps/api` (Fastify) validates, resolves the commit (GitHub API, fixed host, no redirects), enforces quotas, creates the record and enqueues. `apps/worker` consumes BullMQ jobs.
- Pipeline: `queued → fetching → analyzing → persisting → completed | completed_with_limitations`; failures → `failed`; creator may `cancel`; retention → `expired`. Transitions are compare-and-set in the store, so cancellation, retries and duplicate deliveries are race-safe; interrupted jobs are reset to `queued` and re-run (idempotent).
- Isolation: archives are size-capped while streaming, extracted with links/devices skipped and byte/entry budgets enforced while decompressing, then analyzed in a **child process** with an empty environment, `--max-old-space-size`, and a wall-clock kill. Containers run read-only, `cap_drop: ALL`, `no-new-privileges`, pids/memory/CPU limits, tmpfs scratch.
- Management: 256-bit random token in an HttpOnly, SameSite=Strict cookie path-scoped to `/v1/analyses/<id>`; the DB stores only its SHA-256; comparisons are constant-time. Viewing needs only the id (shareable URL).
- Reuse: cache key = owner/repo@commit + analyzer version + schema version + limit config. A reused result is returned without a management capability.
- Quotas: 5 new analyses per client per hour (HMAC of client IP, stored in Postgres), global per-IP request rate limit, queue-depth cap, `IMPORTS_ENABLED=false` safe-disable.
- Local object storage: SeaweedFS (S3 API). MinIO community images were not obtainable from Docker Hub at the time of writing.
- BullMQ 6 makes its Redis client an optional peer; `ioredis` 6 is installed explicitly.

**Consequences / known gaps.**

- Worker network egress is not restricted by the compose file; production must apply an egress policy allowing only `api.github.com` and `codeload.github.com` (plus internal Postgres/Redis/S3). The analyzer itself performs no network I/O.
- The API resolves commits before checking the hourly quota so that reused results do not consume quota; the global rate limit bounds GitHub API usage per client.
- Anonymous management cannot be recovered if the cookie is lost (cleared browser, other device); the result still expires after 24 h.
