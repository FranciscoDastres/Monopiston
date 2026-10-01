FROM node:24.18.0-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json

RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend
COPY packages/contracts packages/contracts

ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @monopiston/contracts build \
    && pnpm --filter @monopiston/frontend build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
