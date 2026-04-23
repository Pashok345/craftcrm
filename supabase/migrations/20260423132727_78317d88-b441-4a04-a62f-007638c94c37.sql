-- Make created_by default to current auth user
ALTER TABLE public.whiteboards ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Replace INSERT policy with a simpler check that auth.uid() is set
DROP POLICY IF EXISTS "Authenticated can create whiteboards" ON public.whiteboards;

CREATE POLICY "Authenticated can create whiteboards"
ON public.whiteboards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());