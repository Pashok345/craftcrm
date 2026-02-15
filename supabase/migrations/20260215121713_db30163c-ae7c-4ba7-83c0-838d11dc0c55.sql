
-- Allow admins to delete any process run
CREATE POLICY "Admins can delete any process run"
ON public.process_runs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete process fields of any process
CREATE POLICY "Admins can delete any process fields"
ON public.process_fields FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete process run comments
CREATE POLICY "Admins can delete any process run comments"
ON public.process_run_comments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete process run attachments
CREATE POLICY "Admins can delete any process run attachments"
ON public.process_run_attachments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
