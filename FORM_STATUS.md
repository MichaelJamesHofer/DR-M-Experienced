# Form Functionality Status

## Current Implementation

The subscribe and contact forms are configured for a static GitHub Pages deployment. They use the Supabase browser client to insert submissions into hosted Postgres without any Next.js API routes or self-hosted server process.

## Data Capture

### Newsletter Subscriptions

- Component: `src/components/newsletter-capture.tsx`
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
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Production uses GitHub Actions repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

## Database Status

The migration in `supabase/migrations/20260617021000_create_form_capture_tables.sql` creates both tables and applies Row Level Security.

Security posture:

- anonymous users can insert form submissions
- anonymous users cannot select captured submissions
- anonymous users cannot update captured submissions
- anonymous users cannot delete captured submissions
- database constraints enforce field lengths, email format, and allowed contact subjects

## Verification Checklist

- `npm run lint`
- `npm run build`
- `npm audit --omit=dev`
- production deployment completes
- live contact form shows success after submission
- live subscribe form shows success after submission
- Supabase Table Editor shows the captured rows
