
-- Track per-user last-read timestamp for task comments
CREATE TABLE IF NOT EXISTS public.task_comment_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

ALTER TABLE public.task_comment_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reads" ON public.task_comment_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reads" ON public.task_comment_reads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reads" ON public.task_comment_reads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reads" ON public.task_comment_reads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_comment_reads_user ON public.task_comment_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_reads_task ON public.task_comment_reads(task_id);
