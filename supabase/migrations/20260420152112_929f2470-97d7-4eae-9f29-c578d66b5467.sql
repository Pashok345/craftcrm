-- Tighten SELECT policy on process_run_comments
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.process_run_comments;

CREATE POLICY "Process run participants can view comments"
ON public.process_run_comments
FOR SELECT
TO authenticated
USING (
  -- Comment author can always see their own
  user_id = auth.uid()
  -- Admins can see all
  OR public.has_role(auth.uid(), 'admin'::app_role)
  -- The user who started the underlying process run
  OR EXISTS (
    SELECT 1 FROM public.process_runs pr
    WHERE pr.id = process_run_comments.process_run_id
      AND pr.started_by = auth.uid()
  )
  -- Anyone else who has already participated (commented) on this run
  OR EXISTS (
    SELECT 1 FROM public.process_run_comments other
    WHERE other.process_run_id = process_run_comments.process_run_id
      AND other.user_id = auth.uid()
  )
  -- The creator of the underlying process definition
  OR EXISTS (
    SELECT 1 FROM public.process_runs pr
    JOIN public.processes p ON p.id = pr.process_id
    WHERE pr.id = process_run_comments.process_run_id
      AND p.created_by = auth.uid()
  )
);