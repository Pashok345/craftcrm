
-- Project attachments
CREATE TABLE public.project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_attachments TO authenticated;
GRANT ALL ON public.project_attachments TO service_role;
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project attachments if member or admin"
  ON public.project_attachments FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Insert project attachments if member or admin"
  ON public.project_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      public.is_project_member(project_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Update project attachments if member or admin"
  ON public.project_attachments FOR UPDATE TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Delete own project attachments or admin"
  ON public.project_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Project comments
CREATE TABLE public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project comments if member or admin"
  ON public.project_comments FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Insert project comments if member or admin"
  ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND (
      public.is_project_member(project_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.manager_id = auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Update own project comments"
  ON public.project_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Delete own project comments or admin"
  ON public.project_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_project_comments_updated
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
