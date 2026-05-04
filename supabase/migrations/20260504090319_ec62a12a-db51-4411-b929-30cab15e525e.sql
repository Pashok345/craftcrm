-- ============ process_runs SELECT tightening ============
DROP POLICY IF EXISTS "Authenticated users can view process runs" ON public.process_runs;

CREATE POLICY "Run participants can view process runs"
ON public.process_runs
FOR SELECT
TO authenticated
USING (
  started_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.id = process_runs.process_id AND p.created_by = auth.uid()
  )
);

-- ============ process_run_attachments SELECT tightening ============
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.process_run_attachments;

CREATE POLICY "Process run participants can view attachments"
ON public.process_run_attachments
FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.process_runs pr
    WHERE pr.id = process_run_attachments.process_run_id
      AND pr.started_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.process_runs pr
    JOIN public.processes p ON p.id = pr.process_id
    WHERE pr.id = process_run_attachments.process_run_id
      AND p.created_by = auth.uid()
  )
);

-- ============ proposal_comments SELECT tightening ============
DROP POLICY IF EXISTS "Authenticated users can view proposal comments" ON public.proposal_comments;

CREATE POLICY "Proposal owners or admins can view proposal comments"
ON public.proposal_comments
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.proposals pr
    WHERE pr.id = proposal_comments.proposal_id
      AND pr.created_by = auth.uid()
  )
);

-- ============ departments INSERT tightening ============
DROP POLICY IF EXISTS "Authenticated users can create departments" ON public.departments;

CREATE POLICY "Admins can create departments"
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ deal_stages mutation tightening ============
DROP POLICY IF EXISTS "Authenticated users can create stages" ON public.deal_stages;
DROP POLICY IF EXISTS "Authenticated users can update stages" ON public.deal_stages;
DROP POLICY IF EXISTS "Authenticated users can delete stages" ON public.deal_stages;

CREATE POLICY "Admins can create deal stages"
ON public.deal_stages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update deal stages"
ON public.deal_stages
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- (existing "Admins can delete any deal stage" already covers DELETE)

-- ============ chat-attachments storage: allow chat members to read ============
DROP POLICY IF EXISTS "Users can view their own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Chat members can view chat attachments" ON storage.objects;

CREATE POLICY "Chat members can view chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    -- uploader (first path segment is the user id)
    auth.uid()::text = (storage.foldername(name))[1]
    -- or the second path segment is a chat id the user is a member of
    OR EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.chat_id::text = (storage.foldername(name))[2]
    )
  )
);