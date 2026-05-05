import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { PenSquare, Plus, Trash2, Search, Folder, User as UserIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Whiteboard {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  project_id: string | null;
  updated_at: string;
  created_at: string;
}

interface ProjectLite {
  id: string;
  title: string;
}

interface TaskLite {
  id: string;
  title: string;
  project_id: string | null;
}

const Whiteboards = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'mine' | 'projects' | 'shared'>('mine');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState<string>('__none__');
  const [newTaskId, setNewTaskId] = useState<string>('__none__');
  const [creating, setCreating] = useState(false);

  const [boardToDelete, setBoardToDelete] = useState<Whiteboard | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setUserId(session.user.id);
    await Promise.all([fetchBoards(), fetchProjects(), fetchTasks()]);
    setLoading(false);
  };

  const fetchBoards = async () => {
    const { data, error } = await supabase
      .from('whiteboards')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBoards((data as Whiteboard[]) || []);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, title').order('title');
    setProjects((data as ProjectLite[]) || []);
  };

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, project_id')
      .order('updated_at', { ascending: false })
      .limit(500);
    setTasks((data as TaskLite[]) || []);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error(t('whiteboardTitle'));
      return;
    }
    setCreating(true);
    // Always pull a fresh user id from the session to avoid RLS mismatch
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? userId;
    if (!uid) {
      setCreating(false);
      toast.error('Auth session missing');
      return;
    }
    const boardId = crypto.randomUUID();
    // If task chosen, inherit project from task
    const linkedTask = newTaskId !== '__none__' ? tasks.find((t) => t.id === newTaskId) : null;
    const projectIdToUse =
      linkedTask?.project_id ?? (newProjectId === '__none__' ? null : newProjectId);

    const { error } = await supabase
      .from('whiteboards')
      .insert({
        id: boardId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        project_id: projectIdToUse,
      });
    if (error) {
      setCreating(false);
      console.error('Whiteboard insert error:', error);
      toast.error(`${error.message}${error.details ? ` — ${error.details}` : ''}`);
      return;
    }

    if (linkedTask) {
      const { error: linkError } = await supabase.from('task_whiteboards').insert({
        task_id: linkedTask.id,
        whiteboard_id: boardId,
        created_by: uid,
      });
      if (linkError) {
        console.error('Task link error:', linkError);
        toast.error(linkError.message);
      }
    }

    setCreating(false);
    toast.success(t('whiteboardCreated'));
    setCreateOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewProjectId('__none__');
    setNewTaskId('__none__');
    navigate(`/whiteboards/${boardId}`);
  };

  const confirmDelete = async () => {
    if (!boardToDelete) return;
    const { error } = await supabase.from('whiteboards').delete().eq('id', boardToDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('whiteboardDeleted'));
      setBoards((prev) => prev.filter((b) => b.id !== boardToDelete.id));
    }
    setBoardToDelete(null);
  };

  const filtered = useMemo(() => {
    let list = boards;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) => b.title.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q),
      );
    }
    if (tab === 'mine') {
      list = list.filter((b) => b.created_by === userId && !b.project_id);
    } else if (tab === 'projects') {
      list = list.filter((b) => !!b.project_id);
    } else {
      list = list.filter((b) => b.created_by !== userId && !b.project_id);
    }
    return list;
  }, [boards, search, tab, userId]);

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => (m[p.id] = p.title));
    return m;
  }, [projects]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <PenSquare className="h-7 w-7 text-primary" />
            {t('whiteboardsTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('whiteboardsDescription')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('newWhiteboard')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('whiteboardSearchUser').replace('сотрудника', 'доску').replace('user', 'board').replace('співробітника', 'дошку')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="mine">{t('myWhiteboards')}</TabsTrigger>
          <TabsTrigger value="projects">{t('projectWhiteboards')}</TabsTrigger>
          <TabsTrigger value="shared">{t('sharedWhiteboards')}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-40 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 flex flex-col items-center text-center gap-3">
                <PenSquare className="h-12 w-12 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">{t('whiteboardEmpty')}</p>
                  <p className="text-sm text-muted-foreground">{t('whiteboardEmptyHint')}</p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="gap-2 mt-2">
                  <Plus className="h-4 w-4" />
                  {t('newWhiteboard')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((b) => (
                <Card
                  key={b.id}
                  className="group cursor-pointer hover:border-primary/60 hover:shadow-md transition-all overflow-hidden"
                  onClick={() => navigate(`/whiteboards/${b.id}`)}
                >
                  <div className="aspect-video bg-gradient-to-br from-primary/10 via-accent/20 to-secondary/30 flex items-center justify-center relative">
                    <PenSquare className="h-10 w-10 text-primary/40" />
                    {b.created_by === userId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBoardToDelete(b);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-1">{b.title}</h3>
                    </div>
                    {b.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {b.project_id && projectMap[b.project_id] && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Folder className="h-3 w-3" />
                          {projectMap[b.project_id]}
                        </Badge>
                      )}
                      {b.created_by === userId && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <UserIcon className="h-3 w-3" />
                          {t('whiteboardOwner')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      {t('whiteboardLastEdited')}: {format(parseISO(b.updated_at), 'dd MMM, HH:mm', { locale: dateLocale })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pr-12">
            <DialogTitle>{t('createWhiteboard')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('whiteboardTitle')}</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('whiteboardDescriptionLabel')}</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('whiteboardLinkProject')}</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('whiteboardNoProject')}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('cancel') || 'Отмена'}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {t('createWhiteboard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!boardToDelete} onOpenChange={(o) => !o && setBoardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{boardToDelete?.title}</AlertDialogTitle>
            <AlertDialogDescription>{t('whiteboardConfirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Отмена'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-1" />
              {t('delete') || 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Whiteboards;
