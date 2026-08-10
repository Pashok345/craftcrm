CREATE TABLE public.wiki_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_categories TO authenticated;
GRANT ALL ON public.wiki_categories TO service_role;
ALTER TABLE public.wiki_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_categories_select" ON public.wiki_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "wiki_categories_insert" ON public.wiki_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "wiki_categories_update" ON public.wiki_categories FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "wiki_categories_delete" ON public.wiki_categories FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER wiki_categories_updated_at BEFORE UPDATE ON public.wiki_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wiki_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  excerpt text,
  category_id uuid REFERENCES public.wiki_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  is_pinned boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wiki_articles_category_idx ON public.wiki_articles(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_articles TO authenticated;
GRANT ALL ON public.wiki_articles TO service_role;
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_articles_select" ON public.wiki_articles FOR SELECT TO authenticated USING (is_published = true OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "wiki_articles_insert" ON public.wiki_articles FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "wiki_articles_update" ON public.wiki_articles FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "wiki_articles_delete" ON public.wiki_articles FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER wiki_articles_updated_at BEFORE UPDATE ON public.wiki_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wiki_article_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.wiki_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_article_comments TO authenticated;
GRANT ALL ON public.wiki_article_comments TO service_role;
ALTER TABLE public.wiki_article_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_comments_select" ON public.wiki_article_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "wiki_comments_insert" ON public.wiki_article_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wiki_comments_update" ON public.wiki_article_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wiki_comments_delete" ON public.wiki_article_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER wiki_comments_updated_at BEFORE UPDATE ON public.wiki_article_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();