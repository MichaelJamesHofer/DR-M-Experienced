# Security Documentation

## Form Capture Security

The site is statically exported and captures contact/newsletter submissions through a Supabase Edge Function. Public browser requests post to the function; the function validates, rate-limits, and writes with server-side credentials.

## Supabase Controls

- Row Level Security is enabled on `contact_messages`.
- Row Level Security is enabled on `newsletter_subscriptions`.
- Public catalog child rows require a published episode, product, or blog parent.
- The editorial affiliate-match view is not available to public roles.
- No public read, insert, update, or delete policies are defined after the Edge Function path is live.
- Direct browser table access is blocked; the Edge Function is the receive-only path.
- Private rate-limit counters store hashed keys, not raw IP addresses.
- Rate-limit counters older than eight days are removed during normal form traffic.
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

Supabase publishable/anonymous keys may only be used with reviewed RLS policies. Never expose a Supabase secret or service-role key. Secret access must remain limited to Supabase Edge Functions, the Supabase dashboard, CLI, trusted administrative tooling, or server-side build steps whose output has been checked for leakage.

## Package Security

Run these checks before deploying:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
npm run test:database-security
```

The Edge Function must also pass Deno check, lint, and tests using `supabase/functions/deno.json` and `supabase/functions/deno.lock`.

## Reporting A Vulnerability

Do not disclose suspected credentials or exploitable details in a public issue. Use GitHub's private vulnerability-reporting flow when available, or contact the repository owner privately through GitHub.

## Monitoring

Monitor Supabase for unusual function invocation volume, validation failures, rate-limit hits, and database growth. If spam becomes a problem beyond the current rate limits, add CAPTCHA such as Cloudflare Turnstile in the Edge Function path.
