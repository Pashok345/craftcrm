-- Add avatar URL to user profiles so uploaded photos persist across the app
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;