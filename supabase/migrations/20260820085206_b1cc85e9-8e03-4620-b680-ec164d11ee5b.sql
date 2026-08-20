CREATE TABLE public.deal_stage_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.deal_stages(id) ON DELETE CASCADE,
  task_title text NOT NULL,
  task_description text,
  assignee_id uuid,
  due_in_days integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_stage_automations TO authenticated;
GRANT ALL ON public.deal_stage_automations TO service_role;

ALTER TABLE public.deal_stage_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view automations"
  ON public.deal_stage_automations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create automations"
  ON public.deal_stage_automations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners or admins can update automations"
  ON public.deal_stage_automations FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners or admins can delete automations"
  ON public.deal_stage_automations FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_deal_stage_automations_stage ON public.deal_stage_automations(stage_id);