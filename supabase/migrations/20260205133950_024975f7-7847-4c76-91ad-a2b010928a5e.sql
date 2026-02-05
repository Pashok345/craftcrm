-- Create proposal_comments table for comments on proposals
CREATE TABLE public.proposal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create proposal_attachments table for file attachments on proposals
CREATE TABLE public.proposal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.proposal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for proposal_comments
CREATE POLICY "Authenticated users can view proposal comments"
ON public.proposal_comments FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create proposal comments"
ON public.proposal_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
ON public.proposal_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.proposal_comments FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for proposal_attachments
CREATE POLICY "Authenticated users can view proposal attachments"
ON public.proposal_attachments FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload proposal attachments"
ON public.proposal_attachments FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own attachments"
ON public.proposal_attachments FOR DELETE
USING (auth.uid() = uploaded_by);

-- Create trigger for updated_at on proposal_comments
CREATE TRIGGER update_proposal_comments_updated_at
BEFORE UPDATE ON public.proposal_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();