
-- 1. process_run_comments INSERT: must be related to the run
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.process_run_comments;
CREATE POLICY "Run participants can create comments"
ON public.process_run_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM process_runs pr WHERE pr.id = process_run_id AND pr.started_by = auth.uid())
    OR EXISTS (SELECT 1 FROM process_runs pr JOIN processes p ON p.id = pr.process_id WHERE pr.id = process_run_id AND p.created_by = auth.uid())
  )
);

-- 2. process_run_attachments INSERT: must be related to the run
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON public.process_run_attachments;
CREATE POLICY "Run participants can upload attachments"
ON public.process_run_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM process_runs pr WHERE pr.id = process_run_id AND pr.started_by = auth.uid())
    OR EXISTS (SELECT 1 FROM process_runs pr JOIN processes p ON p.id = pr.process_id WHERE pr.id = process_run_id AND p.created_by = auth.uid())
  )
);

-- 3. time_entries INSERT: enforce user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create time entries" ON public.time_entries;
CREATE POLICY "Users can create their own time entries"
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid())::text = user_id);

-- 4. task_status_history INSERT: caller must be related to the task
DROP POLICY IF EXISTS "Authenticated users can insert task status history" ON public.task_status_history;
CREATE POLICY "Task-related users can insert task status history"
ON public.task_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = changed_by
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR (t.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()))
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 5. process-attachments storage: extend SELECT to run starters and process creators
DROP POLICY IF EXISTS "Process attachments select" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own process attachments" ON storage.objects;
CREATE POLICY "Process attachment participants can view files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'process-attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.process_run_attachments pra
      JOIN public.process_runs pr ON pr.id = pra.process_run_id
      LEFT JOIN public.processes p ON p.id = pr.process_id
      WHERE pra.file_url = name
        AND (pr.started_by = auth.uid() OR p.created_by = auth.uid())
    )
  )
);

-- 6. proposal-files storage: extend SELECT to proposal owners and admins
DROP POLICY IF EXISTS "Proposal files select" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own proposal files" ON storage.objects;
CREATE POLICY "Proposal participants can view files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'proposal-files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.proposal_attachments pa
      JOIN public.proposals pr ON pr.id = pa.proposal_id
      WHERE pa.file_url = name AND pr.created_by = auth.uid()
    )
  )
);
