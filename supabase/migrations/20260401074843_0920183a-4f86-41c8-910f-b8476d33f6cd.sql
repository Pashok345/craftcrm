
-- 1. Fix profiles: add policy for colleagues to see profiles via shared tasks/projects
-- The public_profiles view already handles safe access. Profiles table policies are correct:
-- own user + admins only. No changes needed for profiles table itself.

-- 2. Fix notifications: restrict who can receive notifications
-- Drop old permissive INSERT policy and add one that checks relationship
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications for related users"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    -- Can notify yourself
    user_id = auth.uid()
    -- Or notify users who share a task
    OR EXISTS (
      SELECT 1 FROM task_assignees ta1
      JOIN task_assignees ta2 ON ta1.task_id = ta2.task_id
      WHERE ta1.user_id = auth.uid() AND ta2.user_id = notifications.user_id
    )
    -- Or notify users who share a project
    OR EXISTS (
      SELECT 1 FROM project_members pm1
      JOIN project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid() AND pm2.user_id = notifications.user_id
    )
    -- Or notify meeting participants
    OR EXISTS (
      SELECT 1 FROM meeting_participants mp1
      JOIN meeting_participants mp2 ON mp1.meeting_id = mp2.meeting_id
      WHERE mp1.user_id = auth.uid() AND mp2.user_id = notifications.user_id
    )
    -- Or notify chat members
    OR EXISTS (
      SELECT 1 FROM chat_members cm1
      JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
      WHERE cm1.user_id = auth.uid() AND cm2.user_id = notifications.user_id
    )
    -- Or admins can notify anyone
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3. Fix proposals: restrict UPDATE/DELETE to owner or admin
DROP POLICY IF EXISTS "Authenticated users can update proposals" ON public.proposals;
CREATE POLICY "Owners or admins can update proposals"
ON public.proposals
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete proposals" ON public.proposals;
CREATE POLICY "Owners or admins can delete proposals"
ON public.proposals
FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can create proposals" ON public.proposals;
CREATE POLICY "Owners can create proposals"
ON public.proposals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
