# Security Documentation

## Form Capture Security

The site is statically exported and captures contact/newsletter submissions through a Supabase Edge Function. Public browser requests post to the function; the function validates, rate-limits, and writes with server-side credentials.

## Supabase Controls

- Row Level Security is enabled on `contact_messages`.
- Row Level Security is enabled on `newsletter_subscriptions`.
- No public read, insert, update, or delete policies are defined after the Edge Function path is live.
- Direct browser table access is blocked; the Edge Function is the receive-only path.
- Private rate-limit counters store hashed keys, not raw IP addresses.
- Database constraints enforce:
  - valid lower-case email format
  - maximum field lengths
  - non-empty names and messages
  - allowed contact subjects

## Client Controls

- Contact form validates required fields before insert.
- Newsletter form validates email before insert.
- Both forms trim user input.
- Both forms include a hidden honeypot field.
- The contact form requires the medical-advice acknowledgement checkbox.
- Duplicate newsletter subscriptions are handled as success.

## Key Handling

Safe for client-side use:

- `NEXT_PUBLIC_SUPABASE_URL`

Do not add a Supabase anon key or service-role key to the frontend unless a future feature explicitly requires it. Service-role access must remain limited to Supabase Edge Functions, the Supabase dashboard, CLI, or trusted administrative tooling.

## Package Security

Run these checks before deploying:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Monitoring

Monitor Supabase for unusual function invocation volume, validation failures, rate-limit hits, and database growth. If spam becomes a problem beyond the current rate limits, add CAPTCHA such as Cloudflare Turnstile in the Edge Function path.
