-- Create process_types table for custom process types
CREATE TABLE public.process_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Insert default process types
INSERT INTO public.process_types (name, is_default, created_by) VALUES
  ('Документ', true, NULL),
  ('Платеж', true, NULL),
  ('Договор', true, NULL),
  ('Задача', true, NULL);

-- Create departments table for custom departments
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Insert default departments
INSERT INTO public.departments (name, is_default, created_by) VALUES
  ('Маркетинг', true, NULL),
  ('Производство', true, NULL),
  ('IT', true, NULL);

-- Create processes table
CREATE TABLE public.processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type_id UUID REFERENCES public.process_types(id),
  department_id UUID REFERENCES public.departments(id),
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create process_fields table for dynamic form fields
CREATE TABLE public.process_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create process_runs table for running processes
CREATE TABLE public.process_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  field_values JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.process_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for process_types (anyone can read, authenticated can create)
CREATE POLICY "Anyone can view process types" ON public.process_types FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create process types" ON public.process_types FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS policies for departments
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create departments" ON public.departments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS policies for processes
CREATE POLICY "Authenticated users can view all processes" ON public.processes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create processes" ON public.processes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their processes" ON public.processes FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their processes" ON public.processes FOR DELETE USING (auth.uid() = created_by);

-- RLS policies for process_fields
CREATE POLICY "Authenticated users can view process fields" ON public.process_fields FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Process creators can manage fields" ON public.process_fields FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.processes WHERE id = process_id AND created_by = auth.uid())
);
CREATE POLICY "Process creators can update fields" ON public.process_fields FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.processes WHERE id = process_id AND created_by = auth.uid())
);
CREATE POLICY "Process creators can delete fields" ON public.process_fields FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.processes WHERE id = process_id AND created_by = auth.uid())
);

-- RLS policies for process_runs
CREATE POLICY "Authenticated users can view process runs" ON public.process_runs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create process runs" ON public.process_runs FOR INSERT WITH CHECK (auth.uid() = started_by);
CREATE POLICY "Run starters can update runs" ON public.process_runs FOR UPDATE USING (auth.uid() = started_by);

-- Create trigger for updated_at
CREATE TRIGGER update_processes_updated_at
BEFORE UPDATE ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();