#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="drm-security-test-${RANDOM}-$$"

cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --rm \
  --name "$container" \
  --env POSTGRES_PASSWORD=audit-only \
  --env PGOPTIONS=--client-min-messages=warning \
  postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193 \
  >/dev/null

for _ in $(seq 1 80); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    sleep 0.5
    if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 0.25
done

docker exec "$container" pg_isready -U postgres >/dev/null
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c \
  "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;" \
  >/dev/null

for migration in "$root_dir"/supabase/migrations/*.sql; do
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
    < "$migration" >/dev/null
done

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$root_dir/supabase/seed.sql" >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$root_dir/supabase/tests/catalog_security.sql" >/dev/null

echo "Database migration and security tests passed."
