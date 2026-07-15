
ALTER TABLE public.processes 
  ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE public.process_runs
  ADD COLUMN IF NOT EXISTS current_step_id TEXT,
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS title TEXT;

CREATE TABLE IF NOT EXISTS public.process_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.process_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'task',
  step_label TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  comment TEXT,
  sla_deadline TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_run_steps TO authenticated;
GRANT ALL ON public.process_run_steps TO service_role;

ALTER TABLE public.process_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View steps of accessible runs" ON public.process_run_steps
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.process_runs r
    WHERE r.id = run_id
      AND (r.started_by = auth.uid() OR assignee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Initiator or assignee can insert steps" ON public.process_run_steps
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.process_runs r
    WHERE r.id = run_id
      AND (r.started_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Assignee or initiator can update steps" ON public.process_run_steps
FOR UPDATE TO authenticated USING (
  assignee_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.process_runs r WHERE r.id = run_id AND r.started_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
) WITH CHECK (
  assignee_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.process_runs r WHERE r.id = run_id AND r.started_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins delete steps" ON public.process_run_steps
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_process_run_steps_updated_at
BEFORE UPDATE ON public.process_run_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_process_run_steps_run ON public.process_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_process_run_steps_assignee ON public.process_run_steps(assignee_id);
CREATE INDEX IF NOT EXISTS idx_process_runs_status ON public.process_runs(status);
CREATE INDEX IF NOT EXISTS idx_process_runs_started_by ON public.process_runs(started_by);
