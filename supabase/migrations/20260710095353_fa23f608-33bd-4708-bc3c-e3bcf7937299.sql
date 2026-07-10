CREATE OR REPLACE FUNCTION public.can_access_task_file(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND (
        t.created_by = _user_id
        OR public.is_task_assignee(t.id, _user_id)
        OR (
          t.project_id IS NOT NULL
          AND public.is_project_member(t.project_id, _user_id)
        )
        OR public.has_role(_user_id, 'admin'::public.app_role)
      )
  );
$$;

DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Task attachment access for related users" ON storage.objects;
DROP POLICY IF EXISTS "Task block attachments readable by task viewers" ON storage.objects;

CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.can_access_task_file(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
);

CREATE POLICY "Task attachments readable by authorized task users"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.can_access_task_file(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
);

CREATE POLICY "Task attachment owners can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.can_access_task_file(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
);