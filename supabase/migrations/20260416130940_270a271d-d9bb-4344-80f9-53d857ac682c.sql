
-- 1. Fix client_interactions INSERT: restrict to client owner or admin
DROP POLICY IF EXISTS "Authenticated users can create interactions" ON public.client_interactions;
CREATE POLICY "Client owners or admins can create interactions"
ON public.client_interactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_interactions.client_id
        AND clients.created_by = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 2. Fix user_roles: add explicit admin-only INSERT and DELETE policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. Fix task_comments SELECT: restrict to task-related users
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.task_comments;
CREATE POLICY "Users can view comments on accessible tasks"
ON public.task_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
        )
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 4. Fix kanban_columns UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users can update kanban columns" ON public.kanban_columns;
CREATE POLICY "Owners or admins can update kanban columns"
ON public.kanban_columns FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete kanban columns" ON public.kanban_columns;
CREATE POLICY "Owners or admins can delete kanban columns"
ON public.kanban_columns FOR DELETE
TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix kanban_task_placements UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users can update placements" ON public.kanban_task_placements;
CREATE POLICY "Task-related users can update placements"
ON public.kanban_task_placements FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = kanban_task_placements.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete placements" ON public.kanban_task_placements;
CREATE POLICY "Task-related users can delete placements"
ON public.kanban_task_placements FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = kanban_task_placements.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
);
