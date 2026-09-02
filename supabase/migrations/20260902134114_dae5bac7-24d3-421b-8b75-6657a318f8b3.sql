DROP POLICY IF EXISTS "Authenticated can insert wiki versions" ON public.wiki_article_versions;
CREATE POLICY "Editors can insert wiki versions"
ON public.wiki_article_versions FOR INSERT TO authenticated
WITH CHECK (
  edited_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.wiki_articles a
    WHERE a.id = wiki_article_versions.article_id
      AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Authenticated users can create tags" ON public.tags;
CREATE POLICY "Authenticated users can create tags"
ON public.tags FOR INSERT TO authenticated
WITH CHECK (created_by = (auth.uid())::text);