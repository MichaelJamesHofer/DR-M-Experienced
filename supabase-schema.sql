-- Supabase Database Schema for Peak Medicine Forms
-- Run this in your Supabase SQL Editor

-- Newsletter Subscriptions Table
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT, -- 'homepage', 'episode', 'footer', etc.
  metadata JSONB -- Additional metadata if needed
);

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB -- Additional metadata if needed
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter_subscriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Secure public inserts with validation
-- Only allow INSERT operations, no SELECT/UPDATE/DELETE for anonymous users

-- Policy: Allow public inserts for newsletter subscriptions with validation
CREATE POLICY "Allow public newsletter subscriptions"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Validate email format (basic check)
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
    -- Limit email length to prevent abuse
    LENGTH(email) <= 255 AND
    -- Validate source is reasonable length
    (source IS NULL OR LENGTH(source) <= 100)
  );

-- Policy: Deny all other operations for anonymous users on newsletter_subscriptions
CREATE POLICY "Deny anonymous newsletter access"
  ON newsletter_subscriptions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Policy: Allow public inserts for contact messages with validation
CREATE POLICY "Allow public contact messages"
  ON contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Validate email format
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
    -- Limit field lengths to prevent abuse
    LENGTH(email) <= 255 AND
    LENGTH(name) <= 200 AND
    LENGTH(subject) <= 200 AND
    LENGTH(message) <= 5000 AND
    -- Ensure required fields are not empty
    TRIM(name) != '' AND
    TRIM(email) != '' AND
    TRIM(subject) != '' AND
    TRIM(message) != ''
  );

-- Policy: Deny all other operations for anonymous users on contact_messages
CREATE POLICY "Deny anonymous contact access"
  ON contact_messages
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Note: To view data, use Supabase Dashboard (authenticated) or create service role policies
-- These policies ensure:
-- 1. Only INSERT is allowed for anonymous users
-- 2. Input validation prevents malicious data
-- 3. No data can be read, updated, or deleted by anonymous users

