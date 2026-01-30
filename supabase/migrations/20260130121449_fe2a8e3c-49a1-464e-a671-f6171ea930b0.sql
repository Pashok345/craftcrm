-- Create table for task status change history
CREATE TABLE public.task_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can view task status history
CREATE POLICY "Authenticated users can view task status history"
ON public.task_status_history
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Any authenticated user can insert into task status history
CREATE POLICY "Authenticated users can insert task status history"
ON public.task_status_history
FOR INSERT
WITH CHECK (auth.uid() = changed_by);

-- Index for faster lookups by task
CREATE INDEX idx_task_status_history_task_id ON public.task_status_history(task_id);

-- Meeting participants notifications: ensure meetings filter by user
-- Users should see meetings they created OR where they are participants
-- This is already handled in the app code, but let's add realtime for meetings

-- Enable realtime for meetings and meeting_participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;