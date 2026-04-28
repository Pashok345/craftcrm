import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, ExternalLink, LayoutGrid, Loader2 } from 'lucide-react';

interface Board {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  updated_at: string;
}

interface TaskWhiteboardLink {
  id: string;
  whiteboard_id: string;
  whiteboard: Board;
}

interface Props {
  taskId: string;
}

export const TaskBoardsTab = ({ taskId }: Props) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [links, setLinks] = useState<TaskWhiteboardLink[]>([]);
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLinks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_whiteboards')
      .select('id, whiteboard_id, whiteboards(id, title, description, thumbnail_url, updated_at)')
      .eq('task_id', taskId);
    if (data) {
      setLinks(
        (data as any[])
          .filter(d => d.whiteboards)
          .map(d => ({
            id: d.id,
            whiteboard_id: d.whiteboard_id,
            whiteboard: d.whiteboards,
          }))
      );
    }
    setLoading(false);
  };

  const fetchAllBoards = async () => {
    const { data } = await supabase
      .from('whiteboards')
      .select('id, title, description, thumbnail_url, updated_at')
      .order('updated_at', { ascending: false });
    if (data) setAllBoards(data as Board[]);
  };

  useEffect(() => {
    fetchLinks();
    fetchAllBoards();
  }, [taskId]);

  const availableBoards = allBoards.filter(
    b => !links.some(l => l.whiteboard_id === b.id)
  );

  const handleAttach = async () => {
    if (!selectedBoardId || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('task_whiteboards').insert({
      task_id: taskId,
      whiteboard_id: selectedBoardId,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    setSelectedBoardId('');
    setAttachOpen(false);
    fetchLinks();
  };

  const handleDetach = async (linkId: string) => {
    const { error } = await supabase.from('task_whiteboards').delete().eq('id', linkId);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    fetchLinks();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          {t('attachedBoards')} ({links.length})
        </h4>
        <Button size="sm" onClick={() => setAttachOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('attachBoard')}
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <LayoutGrid className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {t('noBoardsAttached')}
          </p>
          <Button size="lg" onClick={() => setAttachOpen(true)} className="gap-2">
            <Plus className="h-5 w-5" />
            {t('attachBoard')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map(link => (
            <Card
              key={link.id}
              className="group relative overflow-hidden hover:border-primary/50 transition-colors"
            >
              <Link to={`/whiteboards/${link.whiteboard.id}`} className="block">
                {link.whiteboard.thumbnail_url ? (
                  <img
                    src={link.whiteboard.thumbnail_url}
                    alt={link.whiteboard.title}
                    className="w-full h-32 object-cover bg-muted"
                  />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <LayoutGrid className="h-12 w-12 text-primary/40" />
                  </div>
                )}
                <div className="p-3">
                  <h5 className="font-medium text-sm truncate">{link.whiteboard.title}</h5>
                  {link.whiteboard.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {link.whiteboard.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-primary mt-2">
                    <ExternalLink className="h-3 w-3" />
                    {t('openBoard')}
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  handleDetach(link.id);
                }}
                title={t('detachBoard')}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="pr-12">
          <DialogHeader>
            <DialogTitle>{t('attachBoard')}</DialogTitle>
          </DialogHeader>
          {availableBoards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('noAvailableBoards')}</p>
          ) : (
            <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectBoard')} />
              </SelectTrigger>
              <SelectContent>
                {availableBoards.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAttach} disabled={!selectedBoardId || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('attachBoard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
