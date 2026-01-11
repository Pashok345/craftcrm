-- Add avatar_color field to profiles for custom avatar colors
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT NULL;