-- 1. Plans Table
CREATE TABLE plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  razorpay_plan_id text NOT NULL UNIQUE,
  price_inr integer NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('weekly', 'monthly')),
  daily_message_limit integer NOT NULL,
  monthly_message_limit integer NOT NULL,
  features jsonb DEFAULT '[]'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are viewable by all authenticated users" ON plans FOR SELECT USING (true);
-- No insert/update/delete policies for client; service role only.

-- Insert seed data
INSERT INTO plans (name, razorpay_plan_id, price_inr, billing_interval, daily_message_limit, monthly_message_limit, features)
VALUES 
  ('Pro Weekly', 'plan_mock_weekly_001', 4900, 'weekly', 100, 700, '["Unlimited basic AI chats", "100 messages/day", "Priority support"]'),
  ('Pro Monthly', 'plan_mock_monthly_001', 14900, 'monthly', 100, 3000, '["Unlimited basic AI chats", "100 messages/day", "Priority support"]');

-- 2. Modify Subscriptions Table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id);

-- 3. Processed Webhook Events Table for Idempotency
CREATE TABLE processed_webhook_events (
  razorpay_event_id text PRIMARY KEY,
  processed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No client access; service role only.
