-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task-Tags junction table
CREATE TABLE public.task_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, tag_id)
);

-- Time entries table for time tracking
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Tags policies
CREATE POLICY "Authenticated users can view all tags" ON public.tags
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create tags" ON public.tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tag creators can update their tags" ON public.tags
  FOR UPDATE USING (auth.uid()::text = created_by);

CREATE POLICY "Tag creators can delete their tags" ON public.tags
  FOR DELETE USING (auth.uid()::text = created_by);

-- Task-Tags policies
CREATE POLICY "Authenticated users can view task tags" ON public.task_tags
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can add task tags" ON public.task_tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can remove task tags" ON public.task_tags
  FOR DELETE USING (auth.role() = 'authenticated');

-- Time entries policies
CREATE POLICY "Authenticated users can view all time entries" ON public.time_entries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create time entries" ON public.time_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own time entries" ON public.time_entries
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own time entries" ON public.time_entries
  FOR DELETE USING (auth.uid()::text = user_id);

-- Indexes for performance
CREATE INDEX idx_task_tags_task_id ON public.task_tags(task_id);
CREATE INDEX idx_task_tags_tag_id ON public.task_tags(tag_id);
CREATE INDEX idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);