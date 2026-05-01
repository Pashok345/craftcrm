import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  projectId?: string | null;
}

export const TaskBoardsTab = ({ taskId, projectId }: Props) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [links, setLinks] = useState<TaskWhiteboardLink[]>([]);
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'attach' | 'create'>('create');
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Create-form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

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

  const openDialog = () => {
    // Default to "create" if no boards available, else "attach"
    setMode(availableBoards.length === 0 ? 'create' : 'attach');
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setSelectedBoardId('');
    setNewTitle('');
    setNewDescription('');
  };

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
    resetDialog();
    setDialogOpen(false);
    fetchLinks();
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    setSubmitting(true);

    // Create board
    const boardId = crypto.randomUUID();
    const { error: createError } = await supabase.from('whiteboards').insert({
      id: boardId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      project_id: projectId || null,
    });

    if (createError) {
      setSubmitting(false);
      toast({ title: createError.message, variant: 'destructive' });
      return;
    }

    // Link to task
    const { error: linkError } = await supabase.from('task_whiteboards').insert({
      task_id: taskId,
      whiteboard_id: boardId,
      created_by: user.id,
    });

    setSubmitting(false);

    if (linkError) {
      toast({ title: linkError.message, variant: 'destructive' });
      return;
    }

    toast({ title: t('whiteboardCreated') || 'Дошку створено' });
    resetDialog();
    setDialogOpen(false);
    fetchLinks();
    fetchAllBoards();
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
        <Button size="sm" onClick={openDialog} className="gap-1.5">
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
          <Button size="lg" onClick={openDialog} className="gap-2">
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetDialog(); }}>
        <DialogContent className="pr-12">
          <DialogHeader>
            <DialogTitle>{t('attachBoard')}</DialogTitle>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'attach' | 'create')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">{t('createNew') || 'Створити нову'}</TabsTrigger>
              <TabsTrigger value="attach" disabled={availableBoards.length === 0}>
                {t('selectExisting') || 'Обрати існуючу'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="board-title">{t('whiteboardTitle') || 'Назва'}</Label>
                <Input
                  id="board-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('whiteboardTitle') || 'Назва дошки'}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-desc">{t('description') || 'Опис'}</Label>
                <Textarea
                  id="board-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('description') || 'Опис (необов’язково)'}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="attach" className="pt-2">
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
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            {mode === 'create' ? (
              <Button onClick={handleCreate} disabled={!newTitle.trim() || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (t('create') || 'Створити')}
              </Button>
            ) : (
              <Button onClick={handleAttach} disabled={!selectedBoardId || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('attachBoard')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
