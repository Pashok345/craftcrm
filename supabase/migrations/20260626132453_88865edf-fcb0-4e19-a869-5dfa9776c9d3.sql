CREATE POLICY "Task block attachments readable by task viewers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[2] = 'blocks'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[1]
    AND (
      t.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
      OR (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
      ))
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);