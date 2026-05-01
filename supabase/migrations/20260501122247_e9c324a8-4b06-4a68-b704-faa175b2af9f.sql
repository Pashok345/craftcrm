CREATE TABLE public.comment_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('task','deal','proposal')),
  comment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (comment_type, comment_id, user_id, emoji)
);

CREATE INDEX idx_comment_reactions_lookup ON public.comment_reactions (comment_type, comment_id);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reactions"
  ON public.comment_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add their own reactions"
  ON public.comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.comment_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;
ALTER TABLE public.comment_reactions REPLICA IDENTITY FULL;