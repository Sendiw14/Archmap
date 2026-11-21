# API and worker image. Node runs the TypeScript sources directly (type stripping); no build step.
FROM node:24.11.1-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages packages
COPY apps/api apps/api
COPY apps/worker apps/worker
COPY apps/cli/package.json apps/cli/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@archmap/api..." --filter "@archmap/worker..."

FROM node:24.11.1-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=root:root /app /app
# Offline fixtures (ARCHMAP_SOURCE=fixtures) for smoke tests; not used against GitHub.
COPY --chown=root:root fixtures fixtures
USER node
EXPOSE 4000
CMD ["node", "apps/api/src/main.ts"]
