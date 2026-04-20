-- Tighten task_attachments SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON public.task_attachments;

CREATE POLICY "Task participants can view attachments"
ON public.task_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
        OR (
          t.project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
          )
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);