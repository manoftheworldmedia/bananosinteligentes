# Deployment

## Hosted Test Environment

The repository defines an isolated hosted test environment in `render.yaml`.

It provisions:

- `bananos-test-api`: public headless API with dependency-aware health checks.
- `bananos-test-worker`: private asynchronous processing worker.
- `bananos-test-postgres`: isolated PostgreSQL database.
- `bananos-test-redis`: isolated persistent job queue and cache.
- `bananos-test-shared`: shared generated secrets and staging object-storage configuration.

The API applies Prisma migrations before each deployment. Render deploys API and worker changes only after repository checks pass.

### Required Before First Deploy

1. Push this repository to a GitHub or GitLab repository.
2. In Render, create a Blueprint from the repository's `render.yaml`.
3. Supply the prompted staging-only object-storage values:
   - `OBJECT_STORAGE_ENDPOINT`
   - `OBJECT_STORAGE_REGION`
   - `OBJECT_STORAGE_BUCKET`
   - `OBJECT_STORAGE_ACCESS_KEY`
   - `OBJECT_STORAGE_SECRET_KEY`
4. Never reuse a production bucket, database, Redis instance, or credentials.
5. After the first deployment, create a GitHub `test` environment and set its `TEST_API_URL` variable to the API's Render URL.

Render generates `PASSWORD_PEPPER` and `AUDIT_HASH_SECRET`. They are shared by the API and worker but isolated from every other environment.

### Verification

Run:

```sh
pnpm smoke:test-environment -- https://your-test-api.onrender.com
```

GitHub also runs the smoke test every six hours and on demand through `.github/workflows/test-environment.yml`.

The smoke test requires:

- `/health` to return HTTP `200` with `status: ok`.
- The public foundation permissions contract to respond successfully.

## Local Docker Deployment

Prerequisites:

- Docker with the Compose plugin.
- A `.env` file at the repository root.

Run:

```sh
./scripts/deploy-local.sh
```

The script starts PostgreSQL, Redis, and MinIO; creates the `bananos-local` object-storage bucket; builds the API and worker containers; applies Prisma migrations; starts the API and worker; and checks the API health endpoint.

Useful service URLs:

- API: `http://localhost:4000`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

Local Docker `.env` values should use container service names:

- `DATABASE_URL=postgresql://bananos:bananos_dev_password@postgres:5432/bananos?schema=public`
- `REDIS_URL=redis://redis:6379`
- `OBJECT_STORAGE_ENDPOINT=http://minio:9000`

## Environment Isolation

- Test and production resources must be provisioned independently.
- Test must never use raw production tenant data unless explicitly authorized and audited.
- Object-storage buckets must be environment-specific.
- Secret values must be held by the hosting provider or CI environment, never committed.
- Internal-cost and billing data in test must be synthetic.
- A production deployment requires a separate production blueprint and approval gate.
