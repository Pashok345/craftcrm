-- Fix chat_groups policies - the SELECT policy was blocking INSERT returns
-- because the user wasn't a member yet when the chat was just created

-- Drop and recreate SELECT policy to also allow creator to see their chats
DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.chat_groups;
CREATE POLICY "Users can view chats they are members of"
ON public.chat_groups
FOR SELECT
USING (
  public.is_chat_member(id, auth.uid()) 
  OR created_by = auth.uid()
);

-- The INSERT policy was correct but let's verify
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chat_groups;
CREATE POLICY "Authenticated users can create chats"
ON public.chat_groups
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Also fix chat_members - allow self-insert when creating a chat (as first admin)
DROP POLICY IF EXISTS "Chat admins can add members" ON public.chat_members;
CREATE POLICY "Chat admins can add members"
ON public.chat_members
FOR INSERT
WITH CHECK (
  -- Creator of the chat can add members (including themselves as first member)
  EXISTS (
    SELECT 1
    FROM public.chat_groups g
    WHERE g.id = chat_id
      AND g.created_by = auth.uid()
  )
  -- OR existing admin can add members
  OR public.is_chat_admin(chat_id, auth.uid())
);

-- Fix SELECT for chat_members to also allow by chat creator
DROP POLICY IF EXISTS "Users can view members of their chats" ON public.chat_members;
CREATE POLICY "Users can view members of their chats"
ON public.chat_members
FOR SELECT
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.chat_groups g
    WHERE g.id = chat_id
      AND g.created_by = auth.uid()
  )
);