CREATE OR REPLACE FUNCTION public.is_process_run_participant(_run_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.process_runs pr
    LEFT JOIN public.processes p ON p.id = pr.process_id
    WHERE pr.id = _run_id
      AND (pr.started_by = _user_id OR p.created_by = _user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.process_run_steps s
    WHERE s.run_id = _run_id AND s.assignee_id = _user_id
  )
  OR public.has_role(_user_id, 'admin'::app_role)
$$;

DROP POLICY IF EXISTS "Run participants can view process runs" ON public.process_runs;
CREATE POLICY "Run participants can view process runs"
ON public.process_runs FOR SELECT TO authenticated
USING (public.is_process_run_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Run starters can update runs" ON public.process_runs;
CREATE POLICY "Run participants can update runs"
ON public.process_runs FOR UPDATE TO authenticated
USING (public.is_process_run_participant(id, auth.uid()))
WITH CHECK (public.is_process_run_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Process run participants can view comments" ON public.process_run_comments;
CREATE POLICY "Process run participants can view comments"
ON public.process_run_comments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_process_run_participant(process_run_id, auth.uid()));

DROP POLICY IF EXISTS "Run participants can create comments" ON public.process_run_comments;
CREATE POLICY "Run participants can create comments"
ON public.process_run_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_process_run_participant(process_run_id, auth.uid()));

DROP POLICY IF EXISTS "Process run participants can view attachments" ON public.process_run_attachments;
CREATE POLICY "Process run participants can view attachments"
ON public.process_run_attachments FOR SELECT TO authenticated
USING (uploaded_by = auth.uid() OR public.is_process_run_participant(process_run_id, auth.uid()));

DROP POLICY IF EXISTS "Run participants can upload attachments" ON public.process_run_attachments;
CREATE POLICY "Run participants can upload attachments"
ON public.process_run_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by AND public.is_process_run_participant(process_run_id, auth.uid()));