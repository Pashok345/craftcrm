
DROP POLICY IF EXISTS "Assignees can view their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project members can view project tasks" ON public.tasks;
DROP POLICY IF EXISTS "Task owners, assignees, or admins can update tasks" ON public.tasks;

CREATE POLICY "Assignees can view their tasks"
ON public.tasks
FOR SELECT TO authenticated
USING (public.is_task_assignee(id, auth.uid()));

CREATE POLICY "Project members can view project tasks"
ON public.tasks
FOR SELECT TO authenticated
USING (project_id IS NOT NULL AND public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Task owners, assignees, or admins can update tasks"
ON public.tasks
FOR UPDATE TO authenticated
USING (
  auth.uid() = created_by
  OR public.is_task_assignee(id, auth.uid())
  OR (project_id IS NOT NULL AND public.is_project_member(project_id, auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
