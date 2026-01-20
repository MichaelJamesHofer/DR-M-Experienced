# Security Documentation

## Security Measures Implemented

### 1. Database Security (Supabase RLS)

✅ **Row Level Security (RLS) Enabled**
- Both tables have RLS enabled
- Anonymous users can ONLY insert data (submit forms)
- No read, update, or delete access for anonymous users

✅ **Input Validation at Database Level**
- Email format validation (regex)
- Field length limits (prevents DoS attacks)
- Required field validation
- Empty string prevention

✅ **Policies**
- `newsletter_subscriptions`: INSERT only with email validation
- `contact_messages`: INSERT only with full field validation
- All other operations denied for anonymous users

### 2. Client-Side Security

✅ **Input Sanitization**
- Email addresses: trimmed and lowercased
- Text fields: trimmed and length-limited
- Email format validation before submission

✅ **XSS Prevention**
- No `dangerouslySetInnerHTML` usage
- Vimeo player uses safe DOM manipulation
- All user input is sanitized before database insertion

✅ **Environment Variables**
- Only `NEXT_PUBLIC_*` variables exposed to client (safe for public use)
- Database password (`SUPABASE_DB_PASSWORD`) is server-side only
- Publishable keys are safe for client-side use with RLS

### 3. Package Security

✅ **Vulnerabilities Fixed**
- Next.js vulnerabilities patched via `npm audit fix`
- All dependencies up to date
- No known vulnerabilities in production dependencies

### 4. Form Security

✅ **Newsletter Form**
- Email validation (regex + length check)
- Duplicate email handling (treated as success)
- Source tracking for analytics

✅ **Contact Form**
- All fields validated and sanitized
- Consent checkbox required
- Field length limits enforced
- Email format validation

### 5. API Security

✅ **Supabase Client SDK**
- Uses publishable/anon keys (safe for client-side)
- All requests go through Supabase with RLS enforcement
- No direct database access from client

✅ **No Server-Side Secrets Exposed**
- Database password never exposed to client
- Service role keys not used in client code
- All sensitive operations server-side only

## Security Best Practices

### Environment Variables

**Safe for Client (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_SUPABASE_URL` - Public project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Publishable key (safe with RLS)

**Server-Side Only (No NEXT_PUBLIC_):**
- `SUPABASE_DB_PASSWORD` - Database password (never exposed)

### Rate Limiting

Consider implementing rate limiting in Supabase:
1. Go to **Database** → **Replication** → **Rate Limiting**
2. Set limits for INSERT operations
3. Or use Supabase Edge Functions for custom rate limiting

### Monitoring

Monitor your Supabase dashboard for:
- Unusual insert patterns
- Failed validation attempts
- Database performance

## Updating RLS Policies

If you need to update existing policies, run `supabase-security-policies.sql` in your Supabase SQL Editor. This will:
- Drop old policies
- Create new secure policies with validation
- Ensure no anonymous read/update/delete access

## Security Checklist

- [x] RLS enabled on all tables
- [x] Input validation at database level
- [x] Client-side input sanitization
- [x] Email format validation
- [x] Field length limits
- [x] No XSS vulnerabilities
- [x] No exposed secrets
- [x] Package vulnerabilities fixed
- [x] Anonymous users can only INSERT
- [x] No SELECT/UPDATE/DELETE for anonymous users

