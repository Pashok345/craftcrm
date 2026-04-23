GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_snapshots TO authenticated;

GRANT SELECT ON public.whiteboards TO anon;
GRANT SELECT ON public.whiteboard_members TO anon;
GRANT SELECT ON public.whiteboard_snapshots TO anon;