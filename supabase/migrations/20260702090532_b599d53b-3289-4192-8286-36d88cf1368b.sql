
CREATE OR REPLACE FUNCTION public.can_view_whiteboard(_whiteboard_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboards w
    WHERE w.id = _whiteboard_id
      AND (
        w.created_by = _user_id
        OR EXISTS (
          SELECT 1 FROM public.whiteboard_members m
          WHERE m.whiteboard_id = _whiteboard_id AND m.user_id = _user_id
        )
        OR (
          w.project_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = w.project_id AND pm.user_id = _user_id
          )
        )
        OR public.has_role(_user_id, 'admin'::app_role)
      )
  );
$function$;
