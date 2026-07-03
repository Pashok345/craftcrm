
CREATE POLICY "project-attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-attachments' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (
          p.created_by = auth.uid()
          OR p.manager_id = auth.uid()
          OR public.is_project_member(p.id, auth.uid())
        )
    )
  )
);

CREATE POLICY "project-attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (
          p.created_by = auth.uid()
          OR p.manager_id = auth.uid()
          OR public.is_project_member(p.id, auth.uid())
        )
    )
  )
);

CREATE POLICY "project-attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-attachments' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (p.created_by = auth.uid() OR p.manager_id = auth.uid())
    )
  )
);
