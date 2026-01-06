-- Fix infinite recursion in RLS policies by using SECURITY DEFINER helper functions

CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE chat_id = _chat_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_admin(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE chat_id = _chat_id
      AND user_id = _user_id
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_chat_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_admin(uuid, uuid) TO authenticated;

-- chat_members policies
DROP POLICY IF EXISTS "Users can view members of their chats" ON public.chat_members;
CREATE POLICY "Users can view members of their chats"
ON public.chat_members
FOR SELECT
USING (public.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Chat admins can add members" ON public.chat_members;
CREATE POLICY "Chat admins can add members"
ON public.chat_members
FOR INSERT
WITH CHECK (
  public.is_chat_admin(chat_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.chat_groups g
    WHERE g.id = chat_id
      AND g.created_by = auth.uid()
  )
);

-- chat_groups policies
DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.chat_groups;
CREATE POLICY "Users can view chats they are members of"
ON public.chat_groups
FOR SELECT
USING (public.is_chat_member(id, auth.uid()));

DROP POLICY IF EXISTS "Chat admins can update chats" ON public.chat_groups;
CREATE POLICY "Chat admins can update chats"
ON public.chat_groups
FOR UPDATE
USING (public.is_chat_admin(id, auth.uid()));

-- messages policies
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats"
ON public.messages
FOR SELECT
USING (public.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Users can send messages to their chats" ON public.messages;
CREATE POLICY "Users can send messages to their chats"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_chat_member(chat_id, auth.uid())
);
