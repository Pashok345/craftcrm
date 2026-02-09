-- Fix SECURITY DEFINER view warning by using SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker=on) AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.position,
  p.avatar_url,
  p.avatar_color,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE
  auth.uid() IS NOT NULL
  AND (
    p.user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm1
      JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid()
        AND pm2.user_id = p.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta1
      JOIN public.task_assignees ta2 ON ta1.task_id = ta2.task_id
      WHERE ta1.user_id = auth.uid()
        AND ta2.user_id = p.user_id
    )
  );

GRANT SELECT ON public.public_profiles TO authenticated;
