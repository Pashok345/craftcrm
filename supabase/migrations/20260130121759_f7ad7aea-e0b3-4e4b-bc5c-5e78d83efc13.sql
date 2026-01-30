-- Allow any authenticated user to update task status (for Kanban drag-drop)
DROP POLICY IF EXISTS "Task creators can update their tasks" ON public.tasks;

CREATE POLICY "Authenticated users can update task status"
ON public.tasks
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Add meeting_id column to notifications for meeting-related notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE;

-- Update notifications INSERT policy to allow meeting invites
DROP POLICY IF EXISTS "Users can create notifications for related resources" ON public.notifications;

CREATE POLICY "Users can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (created_by = auth.uid() OR created_by IS NULL)
);