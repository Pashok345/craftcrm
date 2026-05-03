
-- 1. deal_comments: restrict to deal owners/admins
DROP POLICY IF EXISTS "Authenticated users can view deal comments" ON public.deal_comments;
DROP POLICY IF EXISTS "Authenticated users can create deal comments" ON public.deal_comments;

CREATE POLICY "Deal owners or admins can view deal comments"
ON public.deal_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id
    AND (d.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
);

CREATE POLICY "Deal owners or admins can create deal comments"
ON public.deal_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id
    AND (d.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
);

-- 2. project_members: restrict INSERT/DELETE
DROP POLICY IF EXISTS "Authenticated users can add project members" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated users can delete project members" ON public.project_members;

CREATE POLICY "Project owners/managers/admins can add members"
ON public.project_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Project owners/managers/admins/self can remove members"
ON public.project_members FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
);

-- 3. task_assignees: restrict INSERT/DELETE
DROP POLICY IF EXISTS "Authenticated users can add assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "Authenticated users can delete assignees" ON public.task_assignees;

CREATE POLICY "Task owners/project members/admins can add assignees"
ON public.task_assignees FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
      ))
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Task owners/project members/admins/self can remove assignees"
ON public.task_assignees FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id
    AND (
      t.created_by = auth.uid()
      OR (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
      ))
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- 4. time_entries: remove broad SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all time entries" ON public.time_entries;

-- 5. task_status_history: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view task status history" ON public.task_status_history;

CREATE POLICY "Users with task access can view status history"
ON public.task_status_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id
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

-- 6. Storage: task-attachments SELECT must check folder ownership (uploader)
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;

CREATE POLICY "Task attachment access for related users"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.task_attachments ta
      JOIN public.tasks t ON t.id = ta.task_id
      WHERE ta.file_url LIKE '%' || name
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees tas WHERE tas.task_id = t.id AND tas.user_id = auth.uid())
        OR (t.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
        ))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
    )
  )
);
