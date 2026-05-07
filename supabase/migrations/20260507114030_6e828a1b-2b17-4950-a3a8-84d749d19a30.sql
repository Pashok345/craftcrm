
-- ============ kanban_task_placements ============
DROP POLICY IF EXISTS "Authenticated users can manage placements" ON public.kanban_task_placements;

CREATE POLICY "Task-related users can insert placements"
ON public.kanban_task_placements
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = kanban_task_placements.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- ============ task_comments ============
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.task_comments;

CREATE POLICY "Task participants can create comments"
ON public.task_comments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR (t.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- ============ task_attachments ============
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON public.task_attachments;

CREATE POLICY "Task participants can upload attachments"
ON public.task_attachments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR (t.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- ============ task_dependencies ============
DROP POLICY IF EXISTS "Authenticated users can create dependencies" ON public.task_dependencies;

CREATE POLICY "Task participants can create dependencies"
ON public.task_dependencies
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_dependencies.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- ============ project_history ============
DROP POLICY IF EXISTS "Project history viewable by authenticated users" ON public.project_history;

CREATE POLICY "Project members can view history"
ON public.project_history
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_history.project_id AND pm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_history.project_id
      AND (p.created_by = auth.uid() OR p.manager_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============ comment_reactions ============
DROP POLICY IF EXISTS "Authenticated can view reactions" ON public.comment_reactions;

CREATE POLICY "Users can view reactions on accessible comments"
ON public.comment_reactions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    comment_type = 'task'
    AND EXISTS (
      SELECT 1 FROM public.task_comments tc
      JOIN public.tasks t ON t.id = tc.task_id
      WHERE tc.id = comment_reactions.comment_id
        AND (
          t.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
          OR (t.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()))
        )
    )
  )
  OR (
    comment_type = 'process_run'
    AND EXISTS (
      SELECT 1 FROM public.process_run_comments prc
      JOIN public.process_runs pr ON pr.id = prc.process_run_id
      LEFT JOIN public.processes p ON p.id = pr.process_id
      WHERE prc.id = comment_reactions.comment_id
        AND (pr.started_by = auth.uid() OR p.created_by = auth.uid() OR prc.user_id = auth.uid())
    )
  )
  OR (
    comment_type = 'deal'
    AND EXISTS (
      SELECT 1 FROM public.deal_comments dc
      JOIN public.deals d ON d.id = dc.deal_id
      WHERE dc.id = comment_reactions.comment_id
        AND (d.created_by = auth.uid())
    )
  )
  OR (
    comment_type = 'proposal'
    AND EXISTS (
      SELECT 1 FROM public.proposal_comments pc
      JOIN public.proposals pr ON pr.id = pc.proposal_id
      WHERE pc.id = comment_reactions.comment_id
        AND (pr.created_by = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============ task_assignees ============
DROP POLICY IF EXISTS "Authenticated users can view task assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "Authenticated users can view assignees" ON public.task_assignees;

CREATE POLICY "Related users can view task assignees"
ON public.task_assignees
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta2 WHERE ta2.task_id = t.id AND ta2.user_id = auth.uid())
        OR (t.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()))
      )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============ project_members ============
DROP POLICY IF EXISTS "Authenticated users can view project members" ON public.project_members;

CREATE POLICY "Related users can view project members"
ON public.project_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_members pm2
    WHERE pm2.project_id = project_members.project_id AND pm2.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND (p.created_by = auth.uid() OR p.manager_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
