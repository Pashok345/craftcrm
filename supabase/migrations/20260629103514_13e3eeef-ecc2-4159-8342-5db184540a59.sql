
-- 1) Replace client INSERT on project_history with a trigger-based approach
DROP POLICY IF EXISTS "Authenticated users can insert their own history" ON public.project_history;

CREATE OR REPLACE FUNCTION public.log_project_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_history (project_id, user_id, action, field_name, old_value, new_value)
  VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by), 'created', NULL, NULL, NULL);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_project_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.project_history (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by), 'status_changed', 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF (NEW.title IS DISTINCT FROM OLD.title)
     OR (NEW.description IS DISTINCT FROM OLD.description)
     OR (NEW.budget IS DISTINCT FROM OLD.budget)
     OR (NEW.deadline IS DISTINCT FROM OLD.deadline)
     OR (NEW.manager_id IS DISTINCT FROM OLD.manager_id) THEN
    INSERT INTO public.project_history (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by), 'updated', 'project', NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_project_created ON public.projects;
CREATE TRIGGER trg_log_project_created
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_created();

DROP TRIGGER IF EXISTS trg_log_project_updated ON public.projects;
CREATE TRIGGER trg_log_project_updated
AFTER UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_updated();

-- 2) Replace client INSERT on task_status_history with a trigger
DROP POLICY IF EXISTS "Task-related users can insert task status history" ON public.task_status_history;

CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_status_history (task_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(auth.uid(), NEW.created_by));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_task_status_change ON public.tasks;
CREATE TRIGGER trg_log_task_status_change
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_status_change();

-- 3) Tighten storage INSERT policy on task-attachments bucket
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    -- (a) Upload into the user's own folder: <auth.uid()>/...
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- (b) Task block uploads: <taskId>/blocks/... by users with task edit access
    (
      (storage.foldername(name))[2] = 'blocks'
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND (
            t.created_by = auth.uid()
            OR public.is_task_assignee(t.id, auth.uid())
            OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
            OR public.has_role(auth.uid(), 'admin'::app_role)
          )
      )
    )
  )
);
