-- Junction table linking whiteboards to tasks
CREATE TABLE public.task_whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  whiteboard_id UUID NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, whiteboard_id)
);

CREATE INDEX idx_task_whiteboards_task ON public.task_whiteboards(task_id);
CREATE INDEX idx_task_whiteboards_whiteboard ON public.task_whiteboards(whiteboard_id);

ALTER TABLE public.task_whiteboards ENABLE ROW LEVEL SECURITY;

-- View links if user can view the task
CREATE POLICY "Users view task-whiteboard links for accessible tasks"
ON public.task_whiteboards
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_whiteboards.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- Add link if user can edit task and view whiteboard
CREATE POLICY "Users can add whiteboard links to their tasks"
ON public.task_whiteboards
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_whiteboards.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
  AND public.can_view_whiteboard(whiteboard_id, auth.uid())
);

-- Remove link if user created the link, owns the task, or is admin
CREATE POLICY "Users can remove task-whiteboard links"
ON public.task_whiteboards
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_whiteboards.task_id AND t.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);