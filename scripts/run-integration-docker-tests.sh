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
# -u: the image's default "node" user can't write to the bind-mounted
# workspace otherwise (EACCES on CI). npm i -g --prefix: pins pnpm to our own
# version, isolated from the image's root-owned global pnpm (too new for our
# lockfile). Called by full path, not via $PATH: the Jenkins agent's own PATH
# is missing /bin, so a "$PATH" reference here would silently drop it.
docker compose run --rm -u $(id -u):$(id -g) node sh -c "
  npm i -g pnpm@8.6.6 --prefix /tmp/pnpm-local --silent &&
  /tmp/pnpm-local/bin/pnpm i --frozen-lockfile &&
  /tmp/pnpm-local/bin/pnpm exec tsx scripts/wait-for-http.ts http://content-transformer:3000/healthcheck 60000 &&
  TRANSFORMER_URL=http://content-transformer:3000/transform /tmp/pnpm-local/bin/pnpm run test:smoke
"
