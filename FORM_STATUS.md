# Form Functionality Status

## Current Implementation

The subscribe and contact forms are configured for a static GitHub Pages deployment. They post to a Supabase Edge Function, which validates and rate-limits submissions before inserting into hosted Postgres. There are no Next.js API routes or self-hosted server processes.

## Data Capture

### Newsletter Subscriptions

- Component: `src/components/newsletter-capture.tsx`
- Submit endpoint: `supabase/functions/form-submit`
- Table: `newsletter_subscriptions`
- Captures:
  - `email`
  - `source`
  - `page_url`
  - `user_agent`
  - `created_at`

Duplicate email submissions are treated as success so returning subscribers do not see an unnecessary error.

### Contact Messages

- Component: `src/components/contact-form.tsx`
- Submit endpoint: `supabase/functions/form-submit`
- Table: `contact_messages`
- Captures:
  - `name`
  - `email`
  - `subject`
  - `message`
  - `page_url`
  - `user_agent`
  - `created_at`

The form also includes client validation, the required medical-advice acknowledgement, and a hidden honeypot field.

## Configuration

Local development uses `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tdbsuzciwotleualdcjf.supabase.co
```

Production uses this GitHub Actions repository secret:

- `NEXT_PUBLIC_SUPABASE_URL`

## Database Status

The migrations in `supabase/migrations` create both tables, add private rate-limit counters, and apply Row Level Security.

Security posture:

- anonymous users cannot directly insert form submissions into the tables
- anonymous users cannot select captured submissions
- anonymous users cannot update captured submissions
- anonymous users cannot delete captured submissions
- database constraints enforce field lengths, email format, and allowed contact subjects
- the Edge Function handles duplicate newsletter emails as success
- the Edge Function fully validates requests before incrementing hashed IP/email rate-limit counters
- rate-limit records older than eight days are pruned during normal form traffic
- request bodies are read through a strict byte limit, including chunked requests

## Verification Checklist

- `npm run lint`
- `npm run typecheck`
- `npm audit --audit-level=high`
- `npm run test:database-security`
- Deno check, lint, and tests from `README.md`
- `CONTENT_CATALOG_STRICT=true npm run build`
- production deployment completes
- live contact form shows success after submission
- live subscribe form shows success after submission
- Supabase Table Editor shows the captured rows
