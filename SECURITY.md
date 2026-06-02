# Security Documentation

## Form Capture Security

The site is statically exported and captures contact/newsletter submissions through Supabase. Public browser requests use an anon or publishable key only.

## Supabase Controls

- Row Level Security is enabled on `contact_messages`.
- Row Level Security is enabled on `newsletter_subscriptions`.
- Anonymous and authenticated users can only insert valid rows.
- No public read, update, or delete policies are defined.
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
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

Do not add a Supabase service-role key to the frontend, GitHub Pages build output, or any `NEXT_PUBLIC_*` variable. Service-role access should remain limited to Supabase dashboard, CLI, or trusted administrative tooling.

## Package Security

Run these checks before deploying:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Monitoring

Monitor Supabase for unusual insert volume, validation failures, and database growth. If spam becomes a problem, add Supabase-side rate limiting or route form submissions through a Supabase Edge Function with CAPTCHA/rate-limit checks.
