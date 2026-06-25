/*
Email subscriptions for job alerts.

Stores addresses from the "Get job alerts" form on the homepage.
*/

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_subscriptions_public_insert" ON email_subscriptions;
CREATE POLICY "email_subscriptions_public_insert" ON email_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "email_subscriptions_admin_select" ON email_subscriptions;
CREATE POLICY "email_subscriptions_admin_select" ON email_subscriptions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));
