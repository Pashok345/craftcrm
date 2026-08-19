CREATE TABLE public.wiki_article_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.wiki_articles(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  excerpt text,
  tags text[] NOT NULL DEFAULT '{}',
  category_id uuid,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wiki_article_versions TO authenticated;
GRANT ALL ON public.wiki_article_versions TO service_role;

ALTER TABLE public.wiki_article_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view wiki versions"
ON public.wiki_article_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert wiki versions"
ON public.wiki_article_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_wiki_versions_article ON public.wiki_article_versions(article_id, version_number DESC);

CREATE OR REPLACE FUNCTION public.snapshot_wiki_article_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.content IS NOT DISTINCT FROM OLD.content
     AND NEW.excerpt IS NOT DISTINCT FROM OLD.excerpt
     AND NEW.tags IS NOT DISTINCT FROM OLD.tags
     AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM public.wiki_article_versions WHERE article_id = OLD.id;

  INSERT INTO public.wiki_article_versions (article_id, version_number, title, content, excerpt, tags, category_id, edited_by)
  VALUES (OLD.id, v_next, OLD.title, OLD.content, OLD.excerpt, OLD.tags, OLD.category_id, COALESCE(auth.uid(), OLD.updated_by, OLD.created_by));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wiki_article_version
BEFORE UPDATE ON public.wiki_articles
FOR EACH ROW EXECUTE FUNCTION public.snapshot_wiki_article_version();