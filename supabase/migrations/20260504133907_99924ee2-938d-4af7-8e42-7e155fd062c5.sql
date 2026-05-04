DROP POLICY IF EXISTS "Users can add whiteboard links to their tasks" ON public.task_whiteboards;

CREATE POLICY "Users can add whiteboard links to accessible tasks"
ON public.task_whiteboards
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_whiteboards.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
        OR (
          t.project_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
          )
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
  AND public.can_view_whiteboard(whiteboard_id, auth.uid())
);