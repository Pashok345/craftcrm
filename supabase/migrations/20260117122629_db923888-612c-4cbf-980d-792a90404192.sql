-- Fix 1: Secure profiles table - create a public view and restrict base table access
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Create a public profiles view that excludes sensitive data (email, phone)
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker=on) AS
SELECT 
  id, 
  user_id, 
  name, 
  position, 
  avatar_url, 
  avatar_color, 
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Update the SELECT policy to allow collaboration-based viewing
CREATE POLICY "Users can view profiles they collaborate with" ON public.profiles
FOR SELECT USING (
  auth.uid() = user_id  -- Own profile
  OR EXISTS (  -- Project collaborators
    SELECT 1 FROM project_members pm1
    JOIN project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.user_id
  )
  OR EXISTS (  -- Task collaborators (creator or assignee)
    SELECT 1 FROM tasks t
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    WHERE (t.created_by = auth.uid() OR ta.user_id = auth.uid())
    AND (t.created_by = profiles.user_id OR EXISTS (
      SELECT 1 FROM task_assignees ta2 WHERE ta2.task_id = t.id AND ta2.user_id = profiles.user_id
    ))
  )
  OR EXISTS (  -- Chat members
    SELECT 1 FROM chat_members cm1
    JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.user_id
  )
  OR EXISTS (  -- Meeting participants
    SELECT 1 FROM meeting_participants mp1
    JOIN meeting_participants mp2 ON mp1.meeting_id = mp2.meeting_id
    WHERE mp1.user_id = auth.uid() AND mp2.user_id = profiles.user_id
  )
  OR EXISTS (  -- Admin can view all profiles
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);