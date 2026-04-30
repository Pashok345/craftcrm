ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_comments;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER TABLE public.deal_comments REPLICA IDENTITY FULL;
ALTER TABLE public.proposal_comments REPLICA IDENTITY FULL;