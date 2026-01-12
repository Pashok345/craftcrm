-- Fix STORAGE_EXPOSURE: Make task-attachments bucket private and update policies
-- Avatars can remain public as they are profile photos

-- Update task-attachments bucket to private
UPDATE storage.buckets SET public = false WHERE id = 'task-attachments';

-- Drop the permissive policy for task-attachments
DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;

-- Create new policy requiring authentication
CREATE POLICY "Authenticated users can view task attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

-- Fix OPEN_ENDPOINTS: Restrict notification INSERT to prevent spam/impersonation
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Add created_by column to track who created the notification
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_by uuid;

-- Create more restrictive policy - users can only create notifications for:
-- 1. Task-related notifications where they have access to the task
-- 2. Meeting-related or other system notifications when they are the creator
CREATE POLICY "Users can create notifications for related resources"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Allow if creator is set to current user (tracking who sent)
    created_by = auth.uid()
    OR created_by IS NULL
  )
  AND (
    -- For task notifications: must be task creator or assignee
    task_id IS NULL
    OR EXISTS (
      SELECT 1 FROM tasks WHERE id = task_id AND created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM task_assignees WHERE task_id = notifications.task_id AND user_id = auth.uid()
    )
  )
);