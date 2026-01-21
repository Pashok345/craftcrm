-- Add baseline authentication requirement for viewing profiles
-- This prevents unauthenticated/anonymous users from accessing any profile data
-- Authenticated users are still governed by the existing collaboration-based policies

CREATE POLICY "Require authentication to view profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);