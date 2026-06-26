
-- 1. task_content_blocks: replace permissive SELECT
DROP POLICY IF EXISTS "Authenticated can view task blocks" ON public.task_content_blocks;
CREATE POLICY "Task viewers can view blocks"
ON public.task_content_blocks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_content_blocks.task_id
      AND (
        t.created_by = auth.uid()
        OR public.is_task_assignee(t.id, auth.uid())
        OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 2. task_form_responses: replace permissive SELECT
DROP POLICY IF EXISTS "Authenticated can view form responses" ON public.task_form_responses;
CREATE POLICY "Task viewers can view form responses"
ON public.task_form_responses
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.task_content_blocks b
    JOIN public.tasks t ON t.id = b.task_id
    WHERE b.id = task_form_responses.block_id
      AND (
        t.created_by = auth.uid()
        OR public.is_task_assignee(t.id, auth.uid())
        OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
      )
  )
);

-- 3. Storage INSERT policies: require ownership-based path
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Chat members can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND public.is_chat_member(
    ((storage.foldername(name))[2])::uuid,
    auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload process attachments" ON storage.objects;
CREATE POLICY "Owners can upload process attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'process-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated users can upload proposal files" ON storage.objects;
CREATE POLICY "Owners can upload proposal files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposal-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
