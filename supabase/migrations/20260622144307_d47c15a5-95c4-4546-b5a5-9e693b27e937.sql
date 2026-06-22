
-- Custom content blocks attached to a task
CREATE TABLE public.task_content_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text','image','video','divider','file','form','heading')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_content_blocks_task ON public.task_content_blocks(task_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_content_blocks TO authenticated;
GRANT ALL ON public.task_content_blocks TO service_role;

ALTER TABLE public.task_content_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task blocks"
ON public.task_content_blocks FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Task creator or admin can insert blocks"
ON public.task_content_blocks FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Task creator or admin can update blocks"
ON public.task_content_blocks FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Task creator or admin can delete blocks"
ON public.task_content_blocks FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_task_content_blocks_updated_at
BEFORE UPDATE ON public.task_content_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Responses submitted to a form-type block
CREATE TABLE public.task_form_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID NOT NULL REFERENCES public.task_content_blocks(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_form_responses_block ON public.task_form_responses(block_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_form_responses TO authenticated;
GRANT ALL ON public.task_form_responses TO service_role;

ALTER TABLE public.task_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view form responses"
ON public.task_form_responses FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can submit own form response"
ON public.task_form_responses FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Author or admin can update form response"
ON public.task_form_responses FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Author or admin can delete form response"
ON public.task_form_responses FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_task_form_responses_updated_at
BEFORE UPDATE ON public.task_form_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
