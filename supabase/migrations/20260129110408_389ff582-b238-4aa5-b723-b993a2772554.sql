-- 1. Allow any authenticated user to add assignees to tasks
DROP POLICY IF EXISTS "Task creators can manage assignees" ON public.task_assignees;
CREATE POLICY "Authenticated users can add assignees"
ON public.task_assignees
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Task creators can delete assignees" ON public.task_assignees;
CREATE POLICY "Authenticated users can delete assignees"
ON public.task_assignees
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2. Allow any authenticated user to add project members
DROP POLICY IF EXISTS "Project creators and managers can manage members" ON public.project_members;
CREATE POLICY "Authenticated users can add project members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Project creators and managers can delete members" ON public.project_members;
CREATE POLICY "Authenticated users can delete project members"
ON public.project_members
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. Allow all authenticated users to view project members
DROP POLICY IF EXISTS "Project members can view their project members" ON public.project_members;
CREATE POLICY "Authenticated users can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (true);

-- 4. Allow chat members to delete their own membership (leave chat)
CREATE POLICY "Users can leave chats"
ON public.chat_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 5. Allow chat creators to delete chat members
CREATE POLICY "Chat creators can delete members"
ON public.chat_members
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM chat_groups g 
  WHERE g.id = chat_members.chat_id AND g.created_by = auth.uid()
));

-- 6. Allow chat creators to delete chats
CREATE POLICY "Chat creators can delete chats"
ON public.chat_groups
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- 7. Allow deletion of messages by chat creators (for cascade delete)
CREATE POLICY "Chat creators can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM chat_groups g 
  WHERE g.id = messages.chat_id AND g.created_by = auth.uid()
));