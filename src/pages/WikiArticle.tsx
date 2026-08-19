import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Pencil, Trash2, Pin, Eye, MessageSquare, Send, History, Link2 } from 'lucide-react';
import { WikiContent } from '@/lib/wikiMarkdown';
import { WikiVersionHistory } from '@/components/wiki/WikiVersionHistory';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  category_id: string | null;
  tags: string[];
  is_published: boolean;
  is_pinned: boolean;
  views_count: number;
  created_by: string;
  updated_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export default function WikiArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { can } = usePermissions();
  const isAdmin = can('wiki.manage');
  const { user } = useAuth();

  const [article, setArticle] = useState<Article | null>(null);
  const [categoryName, setCategoryName] = useState<{ name: string; color: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [related, setRelated] = useState<{ id: string; title: string; tags: string[] }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadComments = async (articleId: string) => {
    const { data } = await supabase
      .from('wiki_article_comments')
      .select('id,user_id,content,created_at')
      .eq('article_id', articleId)
      .order('created_at');
    setComments((data || []) as Comment[]);
  };

  const loadRelated = useCallback(async (art: Article) => {
    const { data } = await supabase
      .from('wiki_articles')
      .select('id,title,tags,category_id')
      .eq('is_published', true)
      .neq('id', art.id)
      .limit(100);
    const scored = (data || [])
      .map((a: any) => {
        const shared = (a.tags || []).filter((tag: string) => art.tags.includes(tag)).length;
        const sameCat = art.category_id && a.category_id === art.category_id ? 1 : 0;
        return { a, score: shared * 3 + sameCat };
      })
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 5)
      .map((s) => ({ id: s.a.id, title: s.a.title, tags: s.a.tags || [] }));
    setRelated(scored);
  }, []);

  const loadArticle = useCallback(async (countView: boolean) => {
    if (!id) return;
    const { data } = await supabase.from('wiki_articles').select('*').eq('id', id).maybeSingle();
    if (!data) {
      setLoading(false);
      return;
    }
    setArticle(data as Article);
    setCategoryName(null);
    if (data.category_id) {
      const { data: cat } = await supabase
        .from('wiki_categories')
        .select('name,color')
        .eq('id', data.category_id)
        .maybeSingle();
      if (cat) setCategoryName(cat as { name: string; color: string });
    }
    await loadRelated(data as Article);
    if (countView) {
      await supabase.from('wiki_articles').update({ views_count: (data.views_count || 0) + 1 }).eq('id', id);
    }
  }, [id, loadRelated]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      await loadArticle(true);
      await loadComments(id);
      const { data: profs } = await supabase.from('profiles').select('user_id,name');
      setProfiles(Object.fromEntries((profs || []).map((p) => [p.user_id, p.name])));
      setLoading(false);
    })();
  }, [id, loadArticle]);

  const canEdit = !!article && (isAdmin || article.created_by === user?.id);

  const handleDelete = async () => {
    if (!article) return;
    const { error } = await supabase.from('wiki_articles').delete().eq('id', article.id);
    if (error) return toast.error(t('errorOccurred'));
    toast.success(t('deleted'));
    navigate('/wiki');
  };

  const addComment = async () => {
    if (!newComment.trim() || !user || !article) return;
    const { error } = await supabase
      .from('wiki_article_comments')
      .insert({ article_id: article.id, user_id: user.id, content: newComment.trim() });
    if (error) return toast.error(t('errorOccurred'));
    setNewComment('');
    loadComments(article.id);
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from('wiki_article_comments').delete().eq('id', commentId);
    if (error) return toast.error(t('errorOccurred'));
    if (article) loadComments(article.id);
  };

  if (loading) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  if (!article) return <p className="text-muted-foreground text-sm">{t('wikiNotFound')}</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/wiki')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('wiki')}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            {t('wikiVersionHistory')}
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => navigate(`/wiki/${article.id}/edit`)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('edit')}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                {t('delete')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {article.is_pinned && <Pin className="h-4 w-4 text-primary" />}
          {categoryName && (
            <Badge variant="secondary" style={{ backgroundColor: `${categoryName.color}20`, color: categoryName.color }}>
              {categoryName.name}
            </Badge>
          )}
          {!article.is_published && <Badge variant="outline">{t('wikiDraft')}</Badge>}
          {article.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
          ))}
        </div>
        <h1 className="text-3xl font-semibold">{article.title}</h1>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
          <span>{profiles[article.created_by] || ''}</span>
          <span>{format(parseISO(article.updated_at), 'dd.MM.yyyy HH:mm')}</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {article.views_count}
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <WikiContent content={article.content} />
        </CardContent>
      </Card>

      {related.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Link2 className="h-4 w-4" />
              {t('wikiRelated')}
            </div>
            <div className="space-y-2">
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/wiki/${r.id}`)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted transition-colors"
                >
                  <p className="text-sm font-medium">{r.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 font-medium">
            <MessageSquare className="h-4 w-4" />
            {t('comments')}
            <Badge variant="secondary">{comments.length}</Badge>
          </div>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(profiles[c.user_id] || '?').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{profiles[c.user_id] || ''}</span>
                    <span>{format(parseISO(c.created_at), 'dd.MM.yyyy HH:mm')}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                </div>
                {(isAdmin || c.user_id === user?.id) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteComment(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('addComment')}
              rows={2}
            />
            <Button onClick={addComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wikiDeleteArticle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('wikiDeleteArticleHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
