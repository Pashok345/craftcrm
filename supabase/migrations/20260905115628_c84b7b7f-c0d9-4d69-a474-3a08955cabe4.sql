CREATE TABLE public.personal_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_notes TO authenticated;
GRANT ALL ON public.personal_notes TO service_role;

ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personal notes"
ON public.personal_notes FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX personal_notes_user_entity_idx ON public.personal_notes (user_id, entity_type, entity_id);

CREATE TRIGGER update_personal_notes_updated_at
BEFORE UPDATE ON public.personal_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  title text NOT NULL,
  remind_at timestamptz NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
ON public.reminders FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX reminders_user_due_idx ON public.reminders (user_id, is_done, remind_at);

CREATE TRIGGER update_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();