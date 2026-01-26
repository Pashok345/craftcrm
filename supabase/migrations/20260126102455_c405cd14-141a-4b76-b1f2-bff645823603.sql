-- Restrict anonymous read access to process_types

ALTER TABLE public.process_types ENABLE ROW LEVEL SECURITY;

-- Replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view process types" ON public.process_types;

CREATE POLICY "Authenticated users can view process types"
ON public.process_types
FOR SELECT
USING (auth.uid() IS NOT NULL);
