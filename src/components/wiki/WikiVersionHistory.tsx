import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { History, RotateCcw } from 'lucide-react';
import { WikiContent } from '@/lib/wikiMarkdown';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface Version {
  id: string;
  version_number: number;
  title: string;
  content: string;
  excerpt: string | null;
  tags: string[];
  category_id: string | null;
  edited_by: string | null;
  created_at: string;
}

interface Props {
  articleId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Record<string, string>;
  canRestore: boolean;
  onRestored: () => void;
}

export function WikiVersionHistory({ articleId, open, onOpenChange, profiles, canRestore, onRestored }: Props) {
  const { t } = useLanguage();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Version | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Version | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('wiki_article_versions')
        .select('*')
        .eq('article_id', articleId)
        .order('version_number', { ascending: false });
      setVersions((data || []) as Version[]);
      setLoading(false);
    })();
  }, [open, articleId]);

  const restore = async (v: Version) => {
    const { error } = await supabase
      .from('wiki_articles')
      .update({
        title: v.title,
        content: v.content,
        excerpt: v.excerpt,
        tags: v.tags,
        category_id: v.category_id,
      })
      .eq('id', articleId);
    if (error) return toast.error(t('errorOccurred'));
    toast.success(t('wikiVersionRestored'));
    setConfirmRestore(null);
    setSelected(null);
    onOpenChange(false);
    onRestored();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="pr-12">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('wikiVersionHistory')}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('wikiNoVersions')}</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Badge variant="secondary">v{v.version_number}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(v.created_at), 'dd.MM.yyyy HH:mm')}
                      {v.edited_by && profiles[v.edited_by] ? ` · ${profiles[v.edited_by]}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>
                    {t('wikiPreview')}
                  </Button>
                  {canRestore && (
                    <Button size="sm" variant="outline" onClick={() => setConfirmRestore(v)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t('wikiRestore')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="pr-12">
            <DialogTitle>
              {selected ? `v${selected.version_number} — ${selected.title}` : ''}
            </DialogTitle>
          </DialogHeader>
          {selected && <WikiContent content={selected.content} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wikiRestoreConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('wikiRestoreHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRestore && restore(confirmRestore)}>
              {t('wikiRestore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
