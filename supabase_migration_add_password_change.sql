-- Add must_change_password column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Optional: Update existing seed users to true if you want to test immediately
-- UPDATE public.users SET must_change_password = true WHERE pha_id = 'PHA003';
