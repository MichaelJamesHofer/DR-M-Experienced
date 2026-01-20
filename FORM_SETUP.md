# Form Setup Guide

## Current Status

✅ **Forms are functional** - Both contact and newsletter forms work in development
✅ **Supabase Database Integration** - Forms now use your Supabase PostgreSQL database
⚠️ **Configuration required** - You need to add Supabase credentials to environment variables

## Supabase Setup (Recommended)

Your forms are configured to use your Supabase PostgreSQL database. This works perfectly with static export since Supabase client SDK works client-side.

### Step 1: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project (the one with connection string `aws-1-us-east-2.pooler.supabase.com`)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co` - this is different from the pooler URL)
   - **anon/public key** (the `anon` `public` key under "Project API keys", NOT the `service_role` key)

**Note:** Your connection string shows `aws-1-us-east-2.pooler.supabase.com`, but for the client SDK you need the Project URL from the API settings page (usually ends in `.supabase.co`).

### Step 2: Create Database Tables

Run the SQL in `supabase-schema.sql` in your Supabase SQL Editor:

1. Go to **SQL Editor** in Supabase Dashboard
2. Create a new query
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the query

This creates:
- `newsletter_subscriptions` table
- `contact_messages` table
- Proper indexes and Row Level Security policies with input validation

**Security Note:** The schema includes secure RLS policies that:
- Only allow INSERT operations for anonymous users
- Validate email formats and field lengths
- Prevent SELECT/UPDATE/DELETE for anonymous users
- Protect against SQL injection and DoS attacks

### Step 3: Add Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Client SDK (for forms - required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# Use publishable key (recommended) or legacy anon key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key_here
# OR use legacy format:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Direct PostgreSQL Connection String (for migrations, admin tools, etc.)
# Format: postgresql://postgres.USERNAME:PASSWORD@HOST:PORT/DATABASE
SUPABASE_DB_PASSWORD=your_database_password_here

# PostHog Analytics (Optional)
NEXT_PUBLIC_POSTHOG_API_KEY=your_posthog_api_key_here
# Optional: PostHog host (defaults to https://us.i.posthog.com)
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Important:** 
- Use the **publishable key** (format: `sb_publishable_...`) or the `anon` key, NOT the `service_role` key. These are safe for client-side use with Row Level Security enabled.
- The `SUPABASE_DB_PASSWORD` is optional and only needed if you want to use direct PostgreSQL connection for migrations or admin tools.
- Your connection string format: `postgresql://postgres.nlzkbrnfvcltgowmeoqm:${SUPABASE_DB_PASSWORD}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`

### Step 4: Test

1. Restart your dev server: `npm run dev`
2. Submit test forms
3. Check your Supabase Dashboard → **Table Editor** to see the data

## Alternative: Third-Party Services

If you prefer not to use Supabase, you can use these alternatives:

## Setup Options

### Option 1: Formspree (Contact Form) - Recommended

1. Go to [Formspree.io](https://formspree.io) and create a free account
2. Create a new form
3. Copy your form ID (looks like `xvgkqjpn` or similar)
4. Add to your environment variables:
   ```
   NEXT_PUBLIC_FORMSPREE_FORM_ID=your_form_id_here
   ```

**Free tier:** 50 submissions/month

### Option 2: ConvertKit (Newsletter) - Recommended

1. Go to [ConvertKit.com](https://convertkit.com) and create an account
2. Create a form and get:
   - API Key (Settings → Advanced → API Secret)
   - Form ID (from your form URL or settings)
3. Add to your environment variables:
   ```
   NEXT_PUBLIC_CONVERTKIT_API_KEY=your_api_key_here
   NEXT_PUBLIC_CONVERTKIT_FORM_ID=your_form_id_here
   ```

**Free tier:** Up to 1,000 subscribers

### Option 3: Beehiiv (Newsletter Alternative)

1. Go to [Beehiiv.com](https://beehiiv.com) and create an account
2. Get your:
   - API Key (Settings → API)
   - Publication ID (from your publication URL)
3. Add to your environment variables:
   ```
   NEXT_PUBLIC_BEEHIIV_API_KEY=your_api_key_here
   NEXT_PUBLIC_BEEHIIV_PUBLICATION_ID=your_publication_id_here
   ```

## Complete Environment Variables Reference

Create a `.env.local` file in the root directory:

```env
# Supabase (Required for forms)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# Use publishable key (recommended - format: sb_publishable_...)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key_here
# OR use legacy anon key format:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Direct Database Connection (for migrations/admin tools)
SUPABASE_DB_PASSWORD=your_database_password_here

# Alternative: Third-Party Services (if not using Supabase)
# Contact Form (Formspree)
# NEXT_PUBLIC_FORMSPREE_FORM_ID=your_form_id_here

# Newsletter (Choose one)
# NEXT_PUBLIC_CONVERTKIT_API_KEY=your_api_key_here
# NEXT_PUBLIC_CONVERTKIT_FORM_ID=your_form_id_here

# OR use Beehiiv instead
# NEXT_PUBLIC_BEEHIIV_API_KEY=your_api_key_here
# NEXT_PUBLIC_BEEHIIV_PUBLICATION_ID=your_publication_id_here

# PostHog Analytics (Optional)
# For client-side analytics, use NEXT_PUBLIC_ prefix
NEXT_PUBLIC_POSTHOG_API_KEY=your_posthog_api_key_here
# Optional: PostHog host (defaults to https://us.i.posthog.com)
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Using the Database Connection String

If you need the full PostgreSQL connection string (for migrations, admin tools, etc.), you can use:

```typescript
import { getDatabaseConnectionString } from '@/lib/db-connection';

const connectionString = getDatabaseConnectionString();
// Returns: postgresql://postgres.nlzkbrnfvcltgowmeoqm:YOUR_PASSWORD@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

The password is automatically pulled from the `SUPABASE_DB_PASSWORD` environment variable.

## Testing

1. **Development:** Forms will work if you have environment variables set
2. **Production:** Make sure to add environment variables to your hosting platform:
   - Vercel: Project Settings → Environment Variables
   - Netlify: Site Settings → Environment Variables
   - GitHub Pages: Not supported (use a different hosting service)

## Fallback Behavior

If no environment variables are set:
- Forms will attempt to use API routes (won't work in static export)
- Users will see error messages
- Forms will still validate and show proper UI states

## Next Steps

1. Choose your services (Formspree + ConvertKit recommended)
2. Set up accounts and get API keys
3. Add environment variables
4. Test in development: `npm run dev`
5. Deploy and add environment variables to your hosting platform

