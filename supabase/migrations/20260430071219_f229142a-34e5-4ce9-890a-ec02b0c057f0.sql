
DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS status public.meeting_status NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS parent_meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS exception_dates date[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_meetings_parent ON public.meetings(parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);
