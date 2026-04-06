-- 1. Add SELECT policy on profiles for colleagues (shared tasks or projects)
CREATE POLICY "Colleagues can view profiles via shared tasks"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_assignees ta1
      JOIN task_assignees ta2 ON ta1.task_id = ta2.task_id
      WHERE ta1.user_id = auth.uid() AND ta2.user_id = profiles.user_id
    )
  );

CREATE POLICY "Colleagues can view profiles via shared projects"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm1
      JOIN project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.user_id
    )
  );

-- 2. Create kanban_columns table for shared columns
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  color TEXT DEFAULT 'hsl(var(--muted))',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view kanban columns"
  ON public.kanban_columns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create kanban columns"
  ON public.kanban_columns FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update kanban columns"
  ON public.kanban_columns FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete kanban columns"
  ON public.kanban_columns FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 3. Create kanban_task_placements for custom column overrides
CREATE TABLE public.kanban_task_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  column_id UUID REFERENCES public.kanban_columns(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id)
);

ALTER TABLE public.kanban_task_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view placements"
  ON public.kanban_task_placements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage placements"
  ON public.kanban_task_placements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update placements"
  ON public.kanban_task_placements FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete placements"
  ON public.kanban_task_placements FOR DELETE
  USING (auth.uid() IS NOT NULL);