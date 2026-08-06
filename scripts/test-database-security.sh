#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="drm-security-test-${RANDOM}-$$"
audio_migration="$root_dir/supabase/migrations/20260806164500_repoint_episode_audio_to_rss_com.sql"

run_sql_file() {
  local database="$1"
  local file="$2"
  docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    < "$file" >/dev/null
}

run_sql() {
  local database="$1"
  local sql="$2"
  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    -c "$sql" >/dev/null
}

apply_pre_audio_migrations() {
  local database="$1"
  local migration
  for migration in "$root_dir"/supabase/migrations/*.sql; do
    if [[ "$migration" == "$audio_migration" ]]; then
      break
    fi
    run_sql_file "$database" "$migration"
  done
}

set_old_audio_urls() {
  local database="$1"
  docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
with expected(slug, previous_url) as (
  values
    ('brain-fog-part-1', 'https://anchor.fm/s/10e1b0328/podcast/play/114269977/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-0-20%2F416465462-44100-2-550a8bb9b34f.mp3'),
    ('brain-fog-part-2', 'https://anchor.fm/s/10e1b0328/podcast/play/114270231/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-0-20%2F416465800-44100-2-7f319cbf0397f.mp3'),
    ('episode-3-insomnia', 'https://anchor.fm/s/10e1b0328/podcast/play/117879952/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-3-3%2F421308982-44100-2-82d5d3a22b087.mp3'),
    ('episode-4-emf', 'https://anchor.fm/s/10e1b0328/podcast/play/117921586/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-3-3%2F421362576-44100-2-9087d508e502c.mp3'),
    ('episode-5-energy', 'https://anchor.fm/s/10e1b0328/podcast/play/122043282/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-26%2F426898712-44100-2-c5449a97f5849.mp3'),
    ('episode-6-concussion-and-pathophysiology', 'https://anchor.fm/s/10e1b0328/podcast/play/122043520/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-26%2F426898995-44100-2-cec8a1642ebff.mp3'),
    ('episode-7-the-brain-on-fire', 'https://anchor.fm/s/10e1b0328/podcast/play/122048195/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-27%2F426905640-44100-2-7853f297ffd2e.mp3')
)
update public.episodes
   set audio_url = expected.previous_url,
       updated_at = '2000-01-01 00:00:00+00'
  from expected
 where episodes.slug = expected.slug;
SQL
}

assert_approved_audio_urls() {
  local database="$1"
  docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$
declare
  mismatched text;
begin
  with expected(slug, approved_url) as (
    values
      ('brain-fog-part-1', 'https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3'),
      ('brain-fog-part-2', 'https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3'),
      ('episode-3-insomnia', 'https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3'),
      ('episode-4-emf', 'https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3'),
      ('episode-5-energy', 'https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3'),
      ('episode-6-concussion-and-pathophysiology', 'https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3'),
      ('episode-7-the-brain-on-fire', 'https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3')
  )
  select string_agg(expected.slug, ', ' order by expected.slug)
    into mismatched
    from expected
    left join public.episodes on episodes.slug = expected.slug
   where episodes.slug is null
      or episodes.audio_url is distinct from expected.approved_url;

  if mismatched is not null then
    raise exception 'Audio migration test found mismatched rows: %', mismatched;
  end if;
end
$$;
SQL
}

expect_audio_migration_failure() {
  local database="$1"
  local expected_message="$2"
  local output
  local status

  set +e
  output="$(docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    < "$audio_migration" 2>&1)"
  status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    printf 'Expected the audio migration to fail in %s.\n' "$database" >&2
    return 1
  fi
  if [[ "$output" != *"$expected_message"* ]]; then
    printf 'Audio migration failed with an unexpected error in %s.\n%s\n' "$database" "$output" >&2
    return 1
  fi
}

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
  run_sql_file postgres "$migration"
done

run_sql_file postgres "$root_dir/supabase/seed.sql"
run_sql_file postgres "$root_dir/supabase/tests/catalog_security.sql"

# Exercise the production order separately: populated Anchor rows, guarded
# migration, exact RSS.com rows. The normal empty-schema migration path above is
# intentionally retained as the fresh-install test.
docker exec "$container" createdb -U postgres audio_base
apply_pre_audio_migrations audio_base
run_sql_file audio_base "$root_dir/supabase/seed.sql"

docker exec "$container" createdb -U postgres --template=audio_base audio_success
set_old_audio_urls audio_success
run_sql_file audio_success "$audio_migration"
assert_approved_audio_urls audio_success
run_sql audio_success "update public.episodes set updated_at = '2000-01-01 00:00:00+00';"
run_sql_file audio_success "$audio_migration"
run_sql audio_success "do \$\$ begin if exists (select 1 from public.episodes where updated_at is distinct from '2000-01-01 00:00:00+00'::timestamptz) then raise exception 'Idempotent audio migration changed updated_at'; end if; end \$\$;"

docker exec "$container" createdb -U postgres --template=audio_base audio_missing
run_sql audio_missing "delete from public.episodes where slug = 'episode-7-the-brain-on-fire';"
expect_audio_migration_failure audio_missing \
  "Cannot repoint episode audio; missing episode rows: episode-7-the-brain-on-fire"

docker exec "$container" createdb -U postgres --template=audio_base audio_unexpected
set_old_audio_urls audio_unexpected
run_sql audio_unexpected "update public.episodes set audio_url = 'https://example.invalid/unapproved.mp3' where slug = 'brain-fog-part-1';"
expect_audio_migration_failure audio_unexpected \
  "Refusing to overwrite unexpected episode audio URLs: brain-fog-part-1 (https://example.invalid/unapproved.mp3)"
run_sql audio_unexpected "do \$\$ begin if (select count(*) from public.episodes where audio_url like 'https://anchor.fm/%') <> 6 then raise exception 'Failed audio migration was not atomic'; end if; end \$\$;"

docker exec "$container" createdb -U postgres --template=audio_base audio_null
set_old_audio_urls audio_null
run_sql audio_null "update public.episodes set audio_url = null where slug = 'brain-fog-part-2';"
expect_audio_migration_failure audio_null \
  "Refusing to overwrite unexpected episode audio URLs: brain-fog-part-2 (NULL)"

echo "Database migration and security tests passed."
