-- 1. Subscriptions Table
CREATE TABLE subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  razorpay_subscription_id text UNIQUE,
  tier text NOT NULL DEFAULT 'free', -- 'free', 'weekly', 'monthly', 'enterprise'
  status text NOT NULL DEFAULT 'trialing', -- 'trialing', 'active', 'past_due', 'canceled'
  current_period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions." ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Ensure every user gets a default free subscription row if they don't have one
-- This can be handled in application logic or triggers, but for now we'll just rely on application logic to insert/upsert.

-- 2. Usage Logs Table (Weekly Tracking)
CREATE TABLE usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start_date date NOT NULL,
  roadmaps_generated integer DEFAULT 0 NOT NULL,
  notebooks_created integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, week_start_date)
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own usage logs." ON usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own usage logs." ON usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own usage logs." ON usage_logs FOR UPDATE USING (auth.uid() = user_id);

-- 3. Profiles (Optional, if we want API Key storage for BYOK)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_api_key text;
