-- Add is_verified column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Create index for faster queries on verification status
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified);

-- Allow admins to update any profile (for verification toggle)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles 
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));