
DROP POLICY IF EXISTS "Users can update their own membership" ON public.chat_members;

CREATE POLICY "Users can update their own membership"
ON public.chat_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT role FROM public.chat_members cm WHERE cm.id = chat_members.id)
);
