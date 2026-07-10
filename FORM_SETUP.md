# Form Setup

The contact and newsletter forms are designed to work from a passive static deployment. They post to a Supabase Edge Function, which validates requests, applies rate limits, and inserts into hosted Postgres with server-side credentials. Browser clients do not write directly to the tables.

## Production Project

- Supabase project URL: `https://tdbsuzciwotleualdcjf.supabase.co`
- Tables:
  - `contact_messages`
  - `newsletter_subscriptions`
- Function source: `supabase/functions/form-submit/index.ts`
- Migration sources: `supabase/migrations`

## Environment Variables

For local development, create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tdbsuzciwotleualdcjf.supabase.co
```

Production is built by GitHub Actions, so the same value must be configured as a repository secret:

- `NEXT_PUBLIC_SUPABASE_URL`

Do not use a service-role key in the frontend, GitHub Pages build output, or any `NEXT_PUBLIC_*` variable. Service-role access belongs only in Supabase-hosted server-side code.

## Database Setup

Link the local checkout to the production project once, then apply migrations:

```bash
npx supabase link --project-ref tdbsuzciwotleualdcjf
npx supabase db push --linked
```

The migrations:

- creates `contact_messages`
- creates `newsletter_subscriptions`
- creates private rate-limit counters and the `increment_form_rate_limit` RPC
- enables Row Level Security on both tables
- removes anonymous/authenticated direct table access after the Edge Function is live
- enforces email, subject, field length, and non-empty message constraints

## Edge Function Setup

Deploy the hosted receive endpoint:

```bash
npx supabase functions deploy form-submit --use-api
```

`supabase/config.toml` declares this receive-only function public with
`verify_jwt = false`; validation, origin checks, and rate limiting are enforced
inside the handler.

Set `FORM_RATE_LIMIT_SECRET` as a Supabase function secret. Supabase provides the project URL and service key to the Edge Function runtime; they must not be exposed to the static site.

## Verification

1. Run `npm run lint` and `npm run typecheck`.
2. Run `npm run test:database-security` and the Deno checks from `README.md`.
3. Run `CONTENT_CATALOG_STRICT=true npm run build`.
4. Deploy through GitHub Pages.
5. Submit the live contact form and newsletter signup.
6. Confirm rows appear in Supabase Table Editor.

Anonymous users should not be able to read or directly insert captured rows through the Supabase REST API.
