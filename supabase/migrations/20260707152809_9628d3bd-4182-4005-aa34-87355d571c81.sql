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
     OR (NEW.end_date IS DISTINCT FROM OLD.end_date)
     OR (NEW.start_date IS DISTINCT FROM OLD.start_date)
     OR (NEW.manager_id IS DISTINCT FROM OLD.manager_id) THEN
    INSERT INTO public.project_history (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by), 'updated', 'project', NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;