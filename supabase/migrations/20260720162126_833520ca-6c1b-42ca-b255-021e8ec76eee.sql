
ALTER TABLE public.process_fields ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false;
ALTER TABLE public.process_run_steps ADD COLUMN IF NOT EXISTS step_config jsonb;
ALTER TABLE public.process_run_steps ADD COLUMN IF NOT EXISTS step_values jsonb;
