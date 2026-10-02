FROM node:24.18.0-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json

RUN pnpm install --frozen-lockfile

COPY apps/backend apps/backend
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY database/migrations database/migrations

RUN pnpm --filter @monopiston/contracts build \
    && pnpm --filter @monopiston/database build \
    && pnpm --filter @monopiston/backend build

FROM node:24.18.0-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/packages/database/package.json ./packages/database/package.json
COPY --from=build /app/packages/database/dist ./packages/database/dist
# Migraciones + runner para ejecutarlas desde el contenedor (pre-deploy de
# Render o shell) sin depender de psql.
COPY --from=build /app/packages/database/scripts ./packages/database/scripts
COPY --from=build /app/database/migrations ./database/migrations

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health/live" || exit 1

CMD ["sh", "apps/backend/docker-entrypoint.sh"]
