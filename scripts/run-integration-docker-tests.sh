#!/usr/bin/env bash
set -e
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
SCRIPT_DIRECTORY="$(dirname "$FULL_PATH_TO_SCRIPT")"
PROJECT_BASE="$(realpath "$SCRIPT_DIRECTORY/..")"
cd "$PROJECT_BASE"

cleanup() {
  echo "Tearing down the docker-compose stack..."
  docker compose down -v
}
trap cleanup EXIT

echo "Building and starting content-transformer..."
docker compose up -d --build content-transformer

echo "Running integration tests against the running container..."
docker compose run --rm node sh -c "
  pnpm i --frozen-lockfile &&
  pnpm exec tsx scripts/wait-for-http.ts http://content-transformer:3000/healthcheck 60000 &&
  TRANSFORMER_URL=http://content-transformer:3000/transform pnpm run test:smoke
"
