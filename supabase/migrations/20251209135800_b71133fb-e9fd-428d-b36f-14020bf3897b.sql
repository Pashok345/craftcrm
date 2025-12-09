-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Create enum for user positions
CREATE TYPE public.user_position AS ENUM ('director', 'manager', 'developer', 'designer', 'analyst', 'accountant', 'hr', 'other');

-- Update profiles table to add phone, position, and additional info
ALTER TABLE public.profiles 
ADD COLUMN phone TEXT,
ADD COLUMN position user_position DEFAULT 'other',
ADD COLUMN additional_info TEXT;

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  status task_status NOT NULL DEFAULT 'todo',
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task assignees table (executors and observers)
CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('executor', 'observer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id, role)
);

-- Create task comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task attachments table
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting participants table
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks (authenticated users can see all tasks)
CREATE POLICY "Authenticated users can view all tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Task creators can update their tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Task creators can delete their tasks" ON public.tasks
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- RLS Policies for task_assignees
CREATE POLICY "Authenticated users can view task assignees" ON public.task_assignees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Task creators can manage assignees" ON public.task_assignees
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND created_by = auth.uid())
  );

CREATE POLICY "Task creators can delete assignees" ON public.task_assignees
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND created_by = auth.uid())
  );

-- RLS Policies for task_comments
CREATE POLICY "Authenticated users can view comments" ON public.task_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comment authors can update their comments" ON public.task_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Comment authors can delete their comments" ON public.task_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for task_attachments
CREATE POLICY "Authenticated users can view attachments" ON public.task_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upload attachments" ON public.task_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders can delete their attachments" ON public.task_attachments
  FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- RLS Policies for meetings
CREATE POLICY "Authenticated users can view all meetings" ON public.meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Meeting creators can update their meetings" ON public.meetings
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Meeting creators can delete their meetings" ON public.meetings
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- RLS Policies for meeting_participants
CREATE POLICY "Authenticated users can view participants" ON public.meeting_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Meeting creators can manage participants" ON public.meeting_participants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_id AND created_by = auth.uid())
  );

CREATE POLICY "Meeting creators can delete participants" ON public.meeting_participants
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_id AND created_by = auth.uid())
  );

-- RLS Policy for profiles - allow authenticated users to view all profiles
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Storage policies for task attachments
CREATE POLICY "Authenticated users can upload task attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Anyone can view task attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their own attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();