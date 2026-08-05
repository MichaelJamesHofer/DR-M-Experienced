# Dr. M Experienced, with Dr. David Musnick

Static Next.js site for Dr. M Experienced, with Dr. David Musnick. Production content is read from Supabase during the build and exported to GitHub Pages at `drmexperienced.com`.

## Local Development

Create an ignored `.env.local` with the catalog credentials described in `docs/database-content-transition.md`, then run:

```bash
npm ci
npm run dev
```

The site is available at `http://localhost:3000`.

## Content Publishing

Supabase is the production source of truth for episodes, blogs, affiliate resources, and their related content. `npm run sync-episodes` is an optional metadata aid; it does not publish content or run automatically during a build.

The approval-first local publishing workspace is available through `drm-publish`. It validates and fingerprints the edited media and creates an integrity-checked review packet without contacting any platform:

```bash
drm-publish doctor
drm-publish prepare /absolute/path/to/episode.json
```

Production builds use `CONTENT_CATALOG_STRICT=true` and fail when required catalog content is incomplete. Published episodes must include active Vimeo, Spotify, YouTube, and Rumble references.

See:

- `docs/new-episode-process.md`
- `docs/publishing-platform-setup.md`
- `publishing/README.md`
- `docs/blog-content-system.md`
- `docs/database-content-transition.md`

## Forms

The contact and newsletter forms post to `supabase/functions/form-submit`. The public browser cannot write directly to the form tables. The Edge Function validates complete payloads, rate-limits accepted submissions, and writes with server-side credentials.

See `FORM_SETUP.md` and `SECURITY.md` for deployment and security details.

## Verification

Run these checks before deployment:

```bash
npm run lint
npm run typecheck
npm run test:publisher
npm audit --audit-level=high
npm run verify:catalog
npm run test:database-security
npx --yes deno@2.9.2 check --config supabase/functions/deno.json --lock supabase/functions/deno.lock supabase/functions/form-submit/index.ts
npx --yes deno@2.9.2 lint --config supabase/functions/deno.json supabase/functions/form-submit src/lib/analytics-privacy.ts src/lib/analytics-privacy_test.ts
npx --yes deno@2.9.2 test --config supabase/functions/deno.json --lock supabase/functions/deno.lock supabase/functions/form-submit src/lib/analytics-privacy_test.ts
CONTENT_CATALOG_STRICT=true npm run build
```

## Deployment

`.github/workflows/deploy.yml` builds and publishes `out/` after a push to `main`. The workflow uses pinned actions, scoped job permissions, Node 24, publisher tests, Deno checks, database security tests, catalog verification, and a strict static build.
