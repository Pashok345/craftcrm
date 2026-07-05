
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT;

CREATE TABLE IF NOT EXISTS public.project_cover_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.project_cover_library TO authenticated;
GRANT ALL ON public.project_cover_library TO service_role;

ALTER TABLE public.project_cover_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view cover library"
  ON public.project_cover_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert covers"
  ON public.project_cover_library FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update covers"
  ON public.project_cover_library FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete covers"
  ON public.project_cover_library FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
