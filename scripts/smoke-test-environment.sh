#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 https://test-api.example.com"
  exit 2
fi

BASE_URL="${1%/}"

echo "Checking test API health..."
HEALTH="$(curl -fsS --retry 5 --retry-all-errors --retry-delay 3 "$BASE_URL/health")"
printf '%s' "$HEALTH" | grep -q '"status":"ok"'

echo "Checking public foundation contract..."
curl -fsS --retry 3 --retry-all-errors "$BASE_URL/v1/foundation/permissions" >/dev/null

echo "Test environment is healthy: $BASE_URL"
