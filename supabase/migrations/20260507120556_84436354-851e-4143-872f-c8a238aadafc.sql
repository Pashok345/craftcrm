
-- Fix infinite recursion: use security definer functions to avoid self-referencing policies

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_task_assignee(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_id = _task_id AND user_id = _user_id
  )
$$;

-- Rebuild project_members SELECT policy without self-reference
DROP POLICY IF EXISTS "Related users can view project members" ON public.project_members;
CREATE POLICY "Related users can view project members"
ON public.project_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_member(project_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND (p.created_by = auth.uid() OR p.manager_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Rebuild task_assignees SELECT policy without self-reference
DROP POLICY IF EXISTS "Related users can view task assignees" ON public.task_assignees;
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
        OR public.is_task_assignee(t.id, auth.uid())
        OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
      )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
