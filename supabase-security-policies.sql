-- Enhanced Security Policies for Supabase Tables
-- Run this AFTER the initial schema to update RLS policies with validation
-- This replaces the basic policies with secure, validated ones

-- Drop existing policies if they exist (in case you're updating)
DROP POLICY IF EXISTS "Allow public newsletter subscriptions" ON newsletter_subscriptions;
DROP POLICY IF EXISTS "Allow public contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Deny anonymous newsletter access" ON newsletter_subscriptions;
DROP POLICY IF EXISTS "Deny anonymous contact access" ON contact_messages;

-- Secure Policy: Allow public inserts for newsletter subscriptions with validation
CREATE POLICY "Allow public newsletter subscriptions"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Validate email format (basic regex check)
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
    -- Limit email length to prevent abuse
    LENGTH(email) <= 255 AND
    -- Validate source is reasonable length (if provided)
    (source IS NULL OR LENGTH(source) <= 100) AND
    -- Ensure email is not empty after trimming
    TRIM(email) != ''
  );

-- Policy: Deny all other operations for anonymous users on newsletter_subscriptions
-- This ensures anonymous users can ONLY insert, never read, update, or delete
CREATE POLICY "Deny anonymous newsletter access"
  ON newsletter_subscriptions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Secure Policy: Allow public inserts for contact messages with validation
CREATE POLICY "Allow public contact messages"
  ON contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Validate email format
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
    -- Limit field lengths to prevent abuse and DoS
    LENGTH(email) <= 255 AND
    LENGTH(name) <= 200 AND
    LENGTH(subject) <= 200 AND
    LENGTH(message) <= 5000 AND
    -- Ensure required fields are not empty after trimming
    TRIM(name) != '' AND
    TRIM(email) != '' AND
    TRIM(subject) != '' AND
    TRIM(message) != ''
  );

-- Policy: Deny all other operations for anonymous users on contact_messages
-- This ensures anonymous users can ONLY insert, never read, update, or delete
CREATE POLICY "Deny anonymous contact access"
  ON contact_messages
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Security Notes:
-- 1. RLS is enabled on both tables
-- 2. Anonymous users can ONLY INSERT (submit forms)
-- 3. All inputs are validated at the database level
-- 4. Field length limits prevent DoS attacks
-- 5. Email format validation prevents invalid data
-- 6. No SELECT/UPDATE/DELETE access for anonymous users
-- 7. To view data, use Supabase Dashboard (authenticated) or create service role policies

