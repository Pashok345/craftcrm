-- Tighten access to sales/customer data and prevent employee PII leakage

-- 1) CLIENTS: restrict to owner (created_by) or admin
DO $$ BEGIN
  -- Drop overly broad policies
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients';
EXCEPTION WHEN undefined_object THEN
  -- ignore
  NULL;
END $$;

CREATE POLICY "Users can view their clients or admins can view all"
ON public.clients
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can create their own clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

CREATE POLICY "Users can update their clients or admins can update all"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can delete their clients or admins can delete all"
ON public.clients
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);


-- 2) DEALS: restrict to owner (created_by) or admin
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view all deals" ON public.deals';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create deals" ON public.deals';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can update deals" ON public.deals';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can delete deals" ON public.deals';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Users can view their deals or admins can view all"
ON public.deals
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can create their own deals"
ON public.deals
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

CREATE POLICY "Users can update their deals or admins can update all"
ON public.deals
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can delete their deals or admins can delete all"
ON public.deals
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);


-- 3) PROFILES: stop exposing phone/email to collaborators by denying broad SELECT
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view profiles of project collaborators" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view profiles of task collaborators" ON public.profiles';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- 4) PUBLIC PROFILES DIRECTORY: expose only non-sensitive fields via a filtered view
-- This view intentionally excludes email and phone.
-- It is filtered to: self, admin, or collaborators (shared project/task).
CREATE OR REPLACE VIEW public.public_profiles AS
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
