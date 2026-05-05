-- Project change history
CREATE TABLE IF NOT EXISTS public.project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created' | 'updated' | 'status_changed' | 'deleted'
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_history_project ON public.project_history(project_id, created_at DESC);

ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;

-- Anyone who can read projects can read its history
CREATE POLICY "Project history viewable by authenticated users"
ON public.project_history
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert history rows for themselves
CREATE POLICY "Authenticated users can insert their own history"
ON public.project_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
