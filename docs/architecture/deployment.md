# Deployment guide (vendor-neutral)

No production environment exists yet; choosing and paying for hosting is an owner decision. This guide lists what any container host must provide. Operations after deployment: [operations.md](operations.md).

## Topology

```
browser ──HTTPS──> web (Next.js, `next start`)
                     │  rewrites /v1/*, /health/* (same origin)
                     ▼
                   api (Fastify, image: infrastructure/Dockerfile)
                     │            │            │
                 Postgres       Redis      S3-compatible bucket
                     ▲            ▲            ▲
                   worker (same image, `node apps/worker/src/main.ts`)
                     │
                     └──HTTPS egress──> api.github.com, codeload.github.com only
```

- The API must **not** be publicly reachable except through the web origin. Cookies are SameSite=Strict and Origin-checked; the browser must see one origin.
- Run the worker separately from the API and the web. Never analyze inside web request handlers.

## Requirements per component

| Component      | Minimum                                              | Notes                                                                                                                                                                 |
| -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web            | 1 instance, 512 MB                                   | Build with `ARCHMAP_API_URL=<internal API URL>` (rewrites are fixed at build time) and `ARCHMAP_HTTPS_ONLY=1` (HSTS, upgrade-insecure-requests).                      |
| api            | 1–2 instances, 512 MB                                | `TRUST_PROXY` set to the hop count of the load balancer + web proxy so quotas see client IPs. `SECURE_COOKIES=true`.                                                  |
| worker         | 1 instance per 2 concurrent jobs, 2.5 GB RAM, 2 vCPU | Read-only root FS, tmpfs `WORK_DIR` ≥ 512 MB, no privileges, pids limit. Egress allow-list: `api.github.com`, `codeload.github.com`, plus internal Postgres/Redis/S3. |
| Postgres       | 15+ (17 tested), small instance                      | Metadata only; migrations run automatically on start.                                                                                                                 |
| Redis          | 7.x, `maxmemory-policy noeviction`                   | BullMQ requires noeviction.                                                                                                                                           |
| Object storage | Any S3 API (AWS S3, R2, GCS interop, SeaweedFS)      | Private bucket; lifecycle rule deleting objects after 2 days as a backstop to the 24 h sweep.                                                                         |

## Secrets and configuration

Set via the host's secret store (never in images): `DATABASE_URL`, `REDIS_URL`, `S3_*`, `CLIENT_KEY_SECRET` (≥ 32 random chars, e.g. `openssl rand -base64 48`), optional `GITHUB_TOKEN` (no scopes needed). Full list: [operations.md](operations.md#environment).

## Release procedure

1. CI green on the release commit (all jobs in `.github/workflows/ci.yml`).
2. Build and push the image from `infrastructure/Dockerfile`, tagged with the commit SHA. Build the web app with production env.
3. Deploy worker and API together (same analyzer version; cache keys embed it), then web.
4. Smoke test against the deployment:
   `ARCHMAP_IT=1 ARCHMAP_API_URL=https://<host> pnpm vitest run tests/integration -t "deployed API"` requires `ARCHMAP_SOURCE=fixtures` on a staging stack; on production, import a small public repository through `/import`, then delete it.
5. Check `/health/ready`, logs for `job finished`, and error rates.
6. Tag the release (`git tag v1.0.0`), publish release notes from `CHANGELOG.md`.

Rollback: redeploy the previous image tag for API and worker together; migrations are additive.

## Safe-disable

Set `IMPORTS_ENABLED=false` on the API and restart; viewing existing results keeps working.
