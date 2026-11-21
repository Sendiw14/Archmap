# Operations runbook (hosted mode)

## Components

| Process | Command                            | Needs                                                                                         |
| ------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| API     | `node apps/api/src/main.ts`        | Postgres, Redis, S3, outbound HTTPS to api.github.com                                         |
| Worker  | `node apps/worker/src/main.ts`     | Postgres, Redis, S3, outbound HTTPS to api.github.com + codeload.github.com, tmpfs `WORK_DIR` |
| Web     | `pnpm --filter @archmap/web start` | `ARCHMAP_API_URL` pointing at the API (same-origin proxy for `/v1`, `/health`)                |

Local stack: `docker compose -f infrastructure/docker-compose.yml up -d --build` (set `ARCHMAP_SOURCE=fixtures` for offline smoke tests). Offline single process: `pnpm --filter @archmap/api dev:memory`.

## Environment

| Variable                                                  | Required       | Notes                                                                                                                  |
| --------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ARCHMAP_MODE`                                            | –              | `production` (default) or `memory` (API only, offline)                                                                 |
| `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`                  | production     | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` as needed; `S3_CREATE_BUCKET=true` for dev only |
| `CLIENT_KEY_SECRET`                                       | production     | ≥ 32 chars; HMAC key for quota identities. Rotating it resets quotas only.                                             |
| `WEB_ORIGINS`                                             | –              | Comma-separated origins allowed to POST/DELETE                                                                         |
| `TRUST_PROXY`                                             | behind a proxy | Hop count or CIDRs so quotas see the client IP                                                                         |
| `GITHUB_TOKEN`                                            | optional       | Raises GitHub API rate limits; read-only public access is sufficient                                                   |
| `IMPORTS_ENABLED`                                         | –              | `false` = safe-disable public imports (API returns `imports_disabled`)                                                 |
| `ARCHMAP_SOURCE`                                          | –              | `github` (default in production) or `fixtures`                                                                         |
| `ARCHMAP_LIMIT_*`                                         | –              | Override any `DEFAULT_LIMITS` key, e.g. `ARCHMAP_LIMIT_ANALYSIS_TIMEOUT_MS=120000`                                     |
| `WORK_DIR`, `LOG_LEVEL`, `PORT`, `HOST`, `SECURE_COOKIES` | –              |                                                                                                                        |

Invalid or missing configuration stops the process at start with the variable names (never values).

## Migrations

Applied automatically at API and worker start (`packages/hosted/migrations/*.sql`, advisory-locked, transactional, recorded in `schema_migrations`). Migrations are additive; roll back by deploying the previous image — never edit an applied migration.

## Health and monitoring

- `GET /health/live` (process up), `GET /health/ready` (store, queue, artifacts reachable; 503 otherwise).
- Logs: JSON (pino for API, JSON lines for worker) with `x-request-id` / analysis `id` correlation. Cookies and authorization headers are redacted; no source code is logged.
- Watch: queue depth (`countActive`), job durations (`job finished` log `ms`), failure codes (`job failed`), retention sweeps, 429/503 rates.

## Incidents

- Abuse or cost spike: set `IMPORTS_ENABLED=false` and restart the API (viewing existing results keeps working).
- GitHub rate limiting: jobs fail with `github_unavailable` after 3 attempts; add `GITHUB_TOKEN` or reduce concurrency.
- Worker crash: BullMQ re-delivers stalled jobs; `processAnalysis` resets interrupted records and re-runs.
- Redis loss: queued jobs not yet started are lost; their records stay `queued` until expiry. Resubmitting creates new jobs.

## Retention and deletion

Results expire 24 h after creation. The worker sweeps every 5 minutes: deletes the artifact, marks the record `expired` (tombstone without graph data), purges tombstones after 7 days. Creators can delete immediately.

## Backups

Postgres holds only short-lived metadata; S3 holds 24-hour artifacts. Backups are optional; losing them loses at most a day of shareable results.

## Rollback

Deploy the previous image tag for API and worker together (cache keys embed the analyzer version, so mixed versions only reduce reuse).
