GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whiteboards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whiteboard_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whiteboard_snapshots TO authenticated;

GRANT SELECT ON TABLE public.whiteboards TO anon;
GRANT SELECT ON TABLE public.whiteboard_members TO anon;
GRANT SELECT ON TABLE public.whiteboard_snapshots TO anon;