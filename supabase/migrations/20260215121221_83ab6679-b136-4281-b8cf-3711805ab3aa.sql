
-- Allow admins to delete any project
CREATE POLICY "Admins can delete any project"
ON public.projects FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete any process
CREATE POLICY "Admins can delete any process"
ON public.processes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete any deal stage (sales columns)
CREATE POLICY "Admins can delete any deal stage"
ON public.deal_stages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
