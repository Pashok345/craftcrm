-- 1) Таблица досок
CREATE TABLE public.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Новая доска',
  description TEXT,
  created_by UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whiteboards_created_by ON public.whiteboards(created_by);
CREATE INDEX idx_whiteboards_project_id ON public.whiteboards(project_id);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;

-- 2) Участники доски
CREATE TABLE public.whiteboard_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id UUID NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(whiteboard_id, user_id)
);

CREATE INDEX idx_whiteboard_members_whiteboard_id ON public.whiteboard_members(whiteboard_id);
CREATE INDEX idx_whiteboard_members_user_id ON public.whiteboard_members(user_id);

ALTER TABLE public.whiteboard_members ENABLE ROW LEVEL SECURITY;

-- 3) Снимки холста (tldraw store snapshot)
CREATE TABLE public.whiteboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id UUID NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE UNIQUE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whiteboard_snapshots ENABLE ROW LEVEL SECURITY;

-- 4) Helper функции (SECURITY DEFINER чтобы избежать рекурсии RLS)
CREATE OR REPLACE FUNCTION public.is_whiteboard_member(_whiteboard_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboard_members
    WHERE whiteboard_id = _whiteboard_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_whiteboard(_whiteboard_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboards w
    WHERE w.id = _whiteboard_id
      AND (
        w.created_by = _user_id
        OR public.is_whiteboard_member(_whiteboard_id, _user_id)
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
$$;

CREATE OR REPLACE FUNCTION public.can_edit_whiteboard(_whiteboard_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboards w
    WHERE w.id = _whiteboard_id
      AND (
        w.created_by = _user_id
        OR EXISTS (
          SELECT 1 FROM public.whiteboard_members m
          WHERE m.whiteboard_id = _whiteboard_id
            AND m.user_id = _user_id
            AND m.role = 'editor'
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
$$;

-- 5) RLS политики для whiteboards
CREATE POLICY "Users can view accessible whiteboards"
ON public.whiteboards FOR SELECT
TO authenticated
USING (public.can_view_whiteboard(id, auth.uid()));

CREATE POLICY "Authenticated can create whiteboards"
ON public.whiteboards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Editors can update whiteboards"
ON public.whiteboards FOR UPDATE
TO authenticated
USING (public.can_edit_whiteboard(id, auth.uid()));

CREATE POLICY "Owner or admin can delete whiteboards"
ON public.whiteboards FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 6) RLS политики для whiteboard_members
CREATE POLICY "Members visible to whiteboard viewers"
ON public.whiteboard_members FOR SELECT
TO authenticated
USING (public.can_view_whiteboard(whiteboard_id, auth.uid()));

CREATE POLICY "Owner or admin can add members"
ON public.whiteboard_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = whiteboard_id AND w.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Owner or admin can update members"
ON public.whiteboard_members FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = whiteboard_id AND w.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Owner, self or admin can remove members"
ON public.whiteboard_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = whiteboard_id AND w.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 7) RLS политики для whiteboard_snapshots
CREATE POLICY "Snapshots visible to whiteboard viewers"
ON public.whiteboard_snapshots FOR SELECT
TO authenticated
USING (public.can_view_whiteboard(whiteboard_id, auth.uid()));

CREATE POLICY "Editors can insert snapshots"
ON public.whiteboard_snapshots FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_whiteboard(whiteboard_id, auth.uid()));

CREATE POLICY "Editors can update snapshots"
ON public.whiteboard_snapshots FOR UPDATE
TO authenticated
USING (public.can_edit_whiteboard(whiteboard_id, auth.uid()));

CREATE POLICY "Editors can delete snapshots"
ON public.whiteboard_snapshots FOR DELETE
TO authenticated
USING (public.can_edit_whiteboard(whiteboard_id, auth.uid()));

-- 8) Триггер обновления updated_at
CREATE TRIGGER trg_whiteboards_updated_at
BEFORE UPDATE ON public.whiteboards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_whiteboard_snapshots_updated_at
BEFORE UPDATE ON public.whiteboard_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) Realtime
ALTER TABLE public.whiteboards REPLICA IDENTITY FULL;
ALTER TABLE public.whiteboard_snapshots REPLICA IDENTITY FULL;
ALTER TABLE public.whiteboard_members REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_members;