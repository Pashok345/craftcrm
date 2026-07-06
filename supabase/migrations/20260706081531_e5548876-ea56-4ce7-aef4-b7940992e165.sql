DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    -- personal folder path: {userId}/...
    (storage.foldername(name))[1] = (auth.uid())::text
    OR
    -- task folder path: {taskId}/... (any file directly under a task the user can access)
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (
          t.created_by = auth.uid()
          OR public.is_task_assignee(t.id, auth.uid())
          OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
    OR
    -- task blocks path: {taskId}/blocks/...
    (
      (storage.foldername(name))[2] = 'blocks'
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND (
            t.created_by = auth.uid()
            OR public.is_task_assignee(t.id, auth.uid())
            OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
            OR public.has_role(auth.uid(), 'admin'::app_role)
          )
      )
    )
  )
);