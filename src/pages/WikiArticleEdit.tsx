import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Save, X } from 'lucide-react';
import { WikiContent } from '@/lib/wikiMarkdown';
const WikiEditor = lazy(() => import('@/components/wiki/WikiEditor').then((m) => ({ default: m.WikiEditor })));
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function WikiArticleEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('__none__');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('wiki_categories').select('id,name').order('sort_order').order('name');
      setCategories(data || []);
      if (id) {
        const { data: art } = await supabase.from('wiki_articles').select('*').eq('id', id).maybeSingle();
        if (art) {
          setTitle(art.title);
          setContent(art.content);
          setExcerpt(art.excerpt || '');
          setCategoryId(art.category_id || '__none__');
          setTags(art.tags || []);
          setIsPublished(art.is_published);
          setIsPinned(art.is_pinned);
        }
      }
    })();
  }, [id]);

  const addTag = () => {
    const v = tagInput.trim().replace(/^#/, '');
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  const save = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      content,
      excerpt: excerpt.trim() || content.slice(0, 180) || null,
      category_id: categoryId === '__none__' ? null : categoryId,
      tags,
      is_published: isPublished,
      is_pinned: isPinned,
      updated_by: user.id,
    };
    if (isNew) {
      const { data, error } = await supabase
        .from('wiki_articles')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single();
      setSaving(false);
      if (error) return toast.error(t('errorOccurred'));
      toast.success(t('saved'));
      navigate(`/wiki/${data.id}`);
    } else {
      const { error } = await supabase.from('wiki_articles').update(payload).eq('id', id);
      setSaving(false);
      if (error) return toast.error(t('errorOccurred'));
      toast.success(t('saved'));
      navigate(`/wiki/${id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(isNew ? '/wiki' : `/wiki/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back')}
        </Button>
        <Button onClick={save} disabled={!title.trim() || saving}>
          <Save className="h-4 w-4 mr-2" />
          {t('save')}
        </Button>
      </div>

      <h1 className="text-2xl font-semibold">{isNew ? t('wikiNewArticle') : t('wikiEditArticle')}</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>{t('title')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('wikiTitlePlaceholder')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('wikiNoCategory')}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('tags')}</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder={t('wikiTagPlaceholder')}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button onClick={() => setTags(tags.filter((x) => x !== tag))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('wikiExcerpt')}</Label>
            <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={isPublished} onCheckedChange={setIsPublished} id="published" />
              <Label htmlFor="published">{t('wikiPublished')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isPinned} onCheckedChange={setIsPinned} id="pinned" />
              <Label htmlFor="pinned">{t('wikiPinned')}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">{t('wikiWrite')}</TabsTrigger>
          <TabsTrigger value="preview">{t('wikiPreview')}</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Suspense fallback={<div className="h-64 rounded-md bg-muted animate-pulse" />}>
            <WikiEditor value={content} onChange={setContent} rows={20} placeholder={t('wikiContentPlaceholder')} />
          </Suspense>
          <p className="text-xs text-muted-foreground mt-2">{t('wikiMarkdownHint')}</p>
        </TabsContent>
        <TabsContent value="preview">
          <Card>
            <CardContent className="p-6 min-h-[300px]">
              <WikiContent content={content} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
