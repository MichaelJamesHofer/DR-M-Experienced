# Form Setup

The contact and newsletter forms are designed to work from a passive static deployment. They insert directly into Supabase from the browser using a public anon or publishable key, with Row Level Security protecting the captured data.

## Production Project

- Supabase project URL: `https://tdbsuzciwotleualdcjf.supabase.co`
- Tables:
  - `contact_messages`
  - `newsletter_subscriptions`
- Migration source: `supabase/migrations/20260617021000_create_form_capture_tables.sql`

## Environment Variables

For local development, create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tdbsuzciwotleualdcjf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Production is built by GitHub Actions, so the same values must be configured as repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

The anon/publishable key is safe to ship in the static JavaScript bundle because RLS allows public users to insert form submissions only. Do not use a service-role key in this app.

## Database Setup

The project is linked to Supabase CLI. Apply migrations with:

```bash
npx supabase db push --linked
```

The migration:

- creates `contact_messages`
- creates `newsletter_subscriptions`
- enables Row Level Security on both tables
- allows anonymous/authenticated `INSERT`
- does not allow anonymous `SELECT`, `UPDATE`, or `DELETE`
- enforces email, subject, field length, and non-empty message constraints

## Verification

1. Run `npm run lint`.
2. Run `npm run build`.
3. Deploy through GitHub Pages.
4. Submit the live contact form.
5. Submit a live newsletter signup.
6. Confirm rows appear in Supabase Table Editor.

Anonymous users should not be able to read captured rows through the Supabase REST API.
