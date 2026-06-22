
-- Fix user_roles: remove overly broad SELECT
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

-- Fix proposal_comments INSERT: require user has access to proposal
DROP POLICY IF EXISTS "Authenticated users can create proposal comments" ON public.proposal_comments;
CREATE POLICY "Users can create proposal comments on accessible proposals"
ON public.proposal_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.proposals pr
    WHERE pr.id = proposal_comments.proposal_id
      AND (pr.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Fix kanban_task_placements SELECT
DROP POLICY IF EXISTS "Authenticated users can view placements" ON public.kanban_task_placements;
CREATE POLICY "Task-related users can view placements"
ON public.kanban_task_placements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = kanban_task_placements.task_id
      AND (
        t.created_by = auth.uid()
        OR public.is_task_assignee(t.id, auth.uid())
        OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- Fix task_dependencies SELECT
DROP POLICY IF EXISTS "Authenticated users can view dependencies" ON public.task_dependencies;
CREATE POLICY "Task-related users can view dependencies"
ON public.task_dependencies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id IN (task_dependencies.task_id, task_dependencies.depends_on_task_id)
      AND (
        t.created_by = auth.uid()
        OR public.is_task_assignee(t.id, auth.uid())
        OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);
