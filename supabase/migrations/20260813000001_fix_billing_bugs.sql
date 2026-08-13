-- Bug 1: Add trial_ends_at to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone;

-- Update trigger function to also insert into subscriptions with a 7-day trial
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.subscriptions (user_id, tier, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'trialing', now() + interval '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Bug 2 & 3: Seeded plan prices don't match the actual requirement, and placeholder IDs
UPDATE public.plans SET price_inr = 9900, razorpay_plan_id = 'plan_weekly_99' WHERE razorpay_plan_id = 'plan_mock_weekly_001';
UPDATE public.plans SET price_inr = 39900, razorpay_plan_id = 'plan_monthly_399' WHERE razorpay_plan_id = 'plan_mock_monthly_001';
