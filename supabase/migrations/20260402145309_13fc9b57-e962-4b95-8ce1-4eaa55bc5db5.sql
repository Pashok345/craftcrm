DROP POLICY "Authenticated users can update task status" ON public.tasks;

CREATE POLICY "Task owners, assignees, or admins can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.task_assignees
      WHERE task_id = tasks.id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = tasks.project_id AND user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );