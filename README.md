# Bananos Inteligentes

Production foundation for a multi-tenant agricultural intelligence platform.

This repository contains the headless production foundation for the multi-tenant platform, including ingestion, billing and cost controls, insights, agricultural knowledge graph, memory, and Banana Chat service foundations.

## Local Foundation

1. Copy `.env.example` to `.env`.
2. Start local services with `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Generate Prisma client with `pnpm prisma:generate`.
5. Run migrations with `pnpm migrate:dev`.
6. Start the headless API with `pnpm dev`.

The API is intentionally limited to foundation endpoints.

## Local Deployment

For a local Docker deployment, run:

```sh
./scripts/deploy-local.sh
```

See `docs/DEPLOYMENT.md` for details.

## Hosted Test Environment

The isolated hosted test environment is defined in `render.yaml`. It includes the API, worker, PostgreSQL, Redis-compatible queue/cache, migration gate, and staging object-storage configuration.

See `docs/DEPLOYMENT.md` for the first-deploy checklist and smoke-test procedure.
