CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  record_label text,
  action text NOT NULL,
  user_id uuid,
  user_name text,
  user_email text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_table ON public.audit_log (table_name, created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_record ON public.audit_log (record_id);

CREATE OR REPLACE FUNCTION public.record_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[] := '{}';
  v_key text;
  v_uid uuid := auth.uid();
  v_name text;
  v_email text;
  v_label text;
  v_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key NOT IN ('updated_at', 'created_at') AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  v_label := COALESCE(
    COALESCE(v_new, v_old) ->> 'title',
    COALESCE(v_new, v_old) ->> 'name',
    COALESCE(v_new, v_old) ->> 'number',
    COALESCE(v_new, v_old) ->> 'role'
  );

  BEGIN
    v_record_id := (COALESCE(v_new, v_old) ->> 'id')::uuid;
  EXCEPTION WHEN others THEN
    v_record_id := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    SELECT p.name, p.email INTO v_name, v_email
    FROM public.profiles p WHERE p.user_id = v_uid LIMIT 1;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, record_label, action, user_id, user_name, user_email, changed_fields, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_record_id, v_label, TG_OP, v_uid, v_name, v_email, v_changed, v_old, v_new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_deals AFTER INSERT OR UPDATE OR DELETE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_proposals AFTER INSERT OR UPDATE OR DELETE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_processes AFTER INSERT OR UPDATE OR DELETE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_process_runs AFTER INSERT OR UPDATE OR DELETE ON public.process_runs FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_wiki_articles AFTER INSERT OR UPDATE OR DELETE ON public.wiki_articles FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_meetings AFTER INSERT OR UPDATE OR DELETE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.record_audit();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.record_audit();