-- 1. Add reviewer_id column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS reviewer_id uuid;

-- 2. Create project_members table for participants
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_members
CREATE POLICY "Authenticated users can view project members"
ON public.project_members FOR SELECT
USING (true);

CREATE POLICY "Project creators and managers can manage members"
ON public.project_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_id 
    AND (created_by = auth.uid() OR manager_id = auth.uid() OR reviewer_id = auth.uid())
  )
);

CREATE POLICY "Project creators and managers can delete members"
ON public.project_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_id 
    AND (created_by = auth.uid() OR manager_id = auth.uid() OR reviewer_id = auth.uid())
  )
);

-- 3. Create process_run_comments table
CREATE TABLE IF NOT EXISTS public.process_run_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_run_id uuid NOT NULL REFERENCES public.process_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.process_run_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for process_run_comments
CREATE POLICY "Authenticated users can view comments"
ON public.process_run_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create comments"
ON public.process_run_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
ON public.process_run_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.process_run_comments FOR DELETE
USING (auth.uid() = user_id);

-- 4. Create process_run_attachments table
CREATE TABLE IF NOT EXISTS public.process_run_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_run_id uuid NOT NULL REFERENCES public.process_runs(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.process_run_comments(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.process_run_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view attachments"
ON public.process_run_attachments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload attachments"
ON public.process_run_attachments FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders can delete their attachments"
ON public.process_run_attachments FOR DELETE
USING (auth.uid() = uploaded_by);

-- 5. Create storage bucket for process attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('process-attachments', 'process-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can view process attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'process-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload process attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'process-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own process attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'process-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.process_run_comments;