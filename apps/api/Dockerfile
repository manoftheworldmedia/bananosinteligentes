FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/banana-chat/package.json packages/banana-chat/package.json
COPY packages/billing/package.json packages/billing/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ingestion/package.json packages/ingestion/package.json
COPY packages/insights/package.json packages/insights/package.json
COPY packages/knowledge-graph/package.json packages/knowledge-graph/package.json
COPY packages/memory/package.json packages/memory/package.json
COPY packages/object-storage/package.json packages/object-storage/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @bananos/database prisma:generate
RUN pnpm --filter @bananos/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["pnpm", "--filter", "@bananos/api", "start"]
