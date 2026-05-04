
-- Enable RLS on realtime.messages and scope channel subscriptions
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to allowed channels" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to allowed channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Chat channels: only members
  (
    (realtime.topic() LIKE 'chat:%' OR realtime.topic() LIKE 'messages:%')
    AND public.is_chat_member(
      (regexp_replace(realtime.topic(), '^[^:]+:', ''))::uuid,
      auth.uid()
    )
  )
  -- User-scoped private channels (notifications, etc.)
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  -- Generic public/global broadcast channels (no sensitive data)
  OR realtime.topic() IN ('public', 'presence', 'system')
  -- Admins can listen to anything
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
