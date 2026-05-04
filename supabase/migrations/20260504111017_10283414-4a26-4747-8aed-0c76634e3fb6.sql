
-- 1) Profile is_verified bypass: prevent users from setting is_verified on themselves
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (no is_verified)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Helper edge function will handle is_verified during onboarding (admin/service role bypasses RLS)

-- 2) task_tags overpermissive RLS
DROP POLICY IF EXISTS "Authenticated users can view task tags" ON public.task_tags;
DROP POLICY IF EXISTS "Authenticated users can add task tags" ON public.task_tags;
DROP POLICY IF EXISTS "Authenticated users can remove task tags" ON public.task_tags;

CREATE POLICY "Task participants can view tags"
ON public.task_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_tags.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

CREATE POLICY "Task participants can add tags"
ON public.task_tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_tags.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

CREATE POLICY "Task participants can remove tags"
ON public.task_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_tags.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 3) Realtime: restrict 'public'/'presence'/'system' shared topics to admins only
DROP POLICY IF EXISTS "Authenticated can subscribe to allowed channels" ON realtime.messages;

CREATE POLICY "Authenticated can subscribe to allowed channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    (realtime.topic() LIKE 'chat:%' OR realtime.topic() LIKE 'messages:%')
    AND public.is_chat_member((regexp_replace(realtime.topic(), '^[^:]+:', ''))::uuid, auth.uid())
  )
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
