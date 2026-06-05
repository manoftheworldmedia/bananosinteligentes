#!/usr/bin/env sh
set -eu

COMPOSE="${COMPOSE:-docker compose}"

echo "Starting infrastructure..."
$COMPOSE up -d postgres redis minio

echo "Waiting for services to become healthy..."
$COMPOSE up -d --wait postgres redis minio

echo "Ensuring object storage bucket exists..."
$COMPOSE exec -T minio mc alias set local http://localhost:9000 bananos bananos_dev_password >/dev/null
$COMPOSE exec -T minio mc mb --ignore-existing local/bananos-local >/dev/null

echo "Building API and worker images..."
$COMPOSE build api worker

echo "Running database migrations..."
$COMPOSE run --rm api pnpm migrate:deploy

echo "Starting application services..."
$COMPOSE --profile api --profile worker up -d --wait api worker

echo "Checking API health..."
curl -fsS http://localhost:4000/health
echo
echo "Deployment complete: http://localhost:4000/health"
