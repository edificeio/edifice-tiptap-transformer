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
docker compose run --rm --build integration-tests
