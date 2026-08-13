import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BookOpen, Plus, Search, Pin, Eye, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WikiCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_by: string;
}

interface WikiArticle {
  id: string;
  title: string;
  excerpt: string | null;
  category_id: string | null;
  tags: string[];
  is_published: boolean;
  is_pinned: boolean;
  views_count: number;
  created_by: string;
  updated_at: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];

export default function Wiki() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();

  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [categoryIds, setCategoryIds] = useState<(string | null)[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<WikiCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState(COLORS[0]);
  const [deleteCat, setDeleteCat] = useState<WikiCategory | null>(null);

  const load = async () => {
    setLoading(true);

    let query = supabase
      .from('wiki_articles')
      .select(
        'id,title,excerpt,category_id,tags,is_published,is_pinned,views_count,created_by,updated_at',
        { count: 'exact' }
      )
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (activeCategory !== 'all') query = query.eq('category_id', activeCategory);
    const q = search.trim().replace(/[%,()]/g, '');
    if (q) query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);

    const [{ data: cats }, artsRes, { data: catRows }] = await Promise.all([
      supabase.from('wiki_categories').select('*').order('sort_order').order('name'),
      query.range((page - 1) * pageSize, page * pageSize - 1),
      supabase.from('wiki_articles').select('category_id'),
    ]);

    setCategories((cats || []) as WikiCategory[]);
    setArticles((artsRes.data || []) as WikiArticle[]);
    setTotalArticles(artsRes.count || 0);
    setCategoryIds(((catRows || []) as { category_id: string | null }[]).map((r) => r.category_id));
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, activeCategory]);

  useEffect(() => {
    setPage(1);
  }, [search, activeCategory, pageSize]);

  const filtered = articles;

  const countFor = (id: string) => categoryIds.filter((c) => c === id).length;

  const openCatDialog = (cat?: WikiCategory) => {
    setEditingCat(cat || null);
    setCatName(cat?.name || '');
    setCatDesc(cat?.description || '');
    setCatColor(cat?.color || COLORS[0]);
    setCatDialogOpen(true);
  };

  const saveCategory = async () => {
    if (!catName.trim() || !user) return;
    if (editingCat) {
      const { error } = await supabase
        .from('wiki_categories')
        .update({ name: catName.trim(), description: catDesc.trim() || null, color: catColor })
        .eq('id', editingCat.id);
      if (error) return toast.error(t('errorOccurred'));
    } else {
      const { error } = await supabase.from('wiki_categories').insert({
        name: catName.trim(),
        description: catDesc.trim() || null,
        color: catColor,
        created_by: user.id,
      });
      if (error) return toast.error(t('errorOccurred'));
    }
    setCatDialogOpen(false);
    toast.success(t('saved'));
    load();
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCat) return;
    const { error } = await supabase.from('wiki_categories').delete().eq('id', deleteCat.id);
    setDeleteCat(null);
    if (error) return toast.error(t('errorOccurred'));
    toast.success(t('deleted'));
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">{t('wiki')}</h1>
          <Badge variant="secondary">{articles.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openCatDialog()}>
            <FolderOpen className="h-4 w-4 mr-2" />
            {t('wikiNewCategory')}
          </Button>
          <Button onClick={() => navigate('/wiki/new')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('wikiNewArticle')}
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('wikiSearchPlaceholder')}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="space-y-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-muted',
              activeCategory === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
            )}
          >
            <span>{t('wikiAllArticles')}</span>
            <span>{articles.length}</span>
          </button>
          {categories.map((cat) => (
            <div key={cat.id} className="group flex items-center gap-1">
              <button
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-muted',
                  activeCategory === cat.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </span>
                <span>{countFor(cat.id)}</span>
              </button>
              {(isAdmin || cat.created_by === user?.id) && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCatDialog(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteCat(cat)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </aside>

        <div className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>{t('wikiEmpty')}</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((a) => {
              const cat = categories.find((c) => c.id === a.category_id);
              return (
                <Card
                  key={a.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/wiki/${a.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                          <h3 className="font-medium truncate">{a.title}</h3>
                          {!a.is_published && <Badge variant="outline">{t('wikiDraft')}</Badge>}
                        </div>
                        {a.excerpt && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {cat && (
                            <Badge
                              variant="secondary"
                              style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                            >
                              {cat.name}
                            </Badge>
                          )}
                          {a.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Eye className="h-3.5 w-3.5" />
                        {a.views_count}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          <DataPagination
            page={page}
            pageSize={pageSize}
            total={totalArticles}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader className="pr-12">
            <DialogTitle>{editingCat ? t('wikiEditCategory') : t('wikiNewCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{t('color')}</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCatColor(c)}
                    className={cn('h-7 w-7 rounded-full border-2', catColor === c ? 'border-foreground' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={saveCategory} disabled={!catName.trim()}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wikiDeleteCategory')}</AlertDialogTitle>
            <AlertDialogDescription>{t('wikiDeleteCategoryHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCategory}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
