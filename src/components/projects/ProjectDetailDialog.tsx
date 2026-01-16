import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, CheckCircle2, Clock, AlertCircle, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Project, Task, ProjectStatus } from '@/types/database';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { ProjectEditDialog } from './ProjectEditDialog';
import { format, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Collapsible description component
const CollapsibleDescription = ({ description }: { description: string }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const lines = description.split('\n');
  const hasMoreThanSevenLines = description.length > 350 || lines.length > 7;
  
  // Approximate 7 lines worth of text (about 350 characters or 7 actual lines)
  const truncatedText = hasMoreThanSevenLines && !expanded
    ? description.slice(0, 350) + '...'
    : description;

  return (
    <div className="mt-1">
      <p className="text-muted-foreground whitespace-pre-wrap">
        {truncatedText}
      </p>
      {hasMoreThanSevenLines && (
        <Button
          variant="link"
          size="sm"
          className="p-0 h-auto text-primary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('showLess') : t('showMore')}
        </Button>
      )}
    </div>
  );
};

interface ProjectDetailDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ProjectDetailDialog = ({ project, open, onOpenChange, onUpdate }: ProjectDetailDialogProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const statusLabels: Record<string, string> = {
    todo: t('statusTodo'),
    in_progress: t('statusInProgress'),
    review: t('statusReview'),
    done: t('statusDone'),
  };

  const STATUS_COLORS: Record<string, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-crm-warning/10 text-crm-warning',
    review: 'bg-primary/10 text-primary',
    done: 'bg-crm-success/10 text-crm-success',
  };

  const projectStatusLabels: Record<string, string> = {
    planning: t('projectPlanning'),
    active: t('projectActive'),
    on_hold: t('projectOnHold'),
    completed: t('projectCompleted'),
    cancelled: t('projectCancelled'),
  };

  const PROJECT_STATUS_COLORS: Record<string, string> = {
    planning: 'bg-muted text-muted-foreground',
    active: 'bg-crm-success/10 text-crm-success',
    on_hold: 'bg-crm-warning/10 text-crm-warning',
    completed: 'bg-primary/10 text-primary',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  useEffect(() => {
    if (open && project) {
      fetchTasks();
    }
  }, [open, project]);

  const fetchTasks = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id);
      if (error) throw error;
      toast({ title: t('projectDeleted') });
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    }
  };

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
    onOpenChange(false);
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    return { total, done, inProgress, todo };
  };

  const stats = getTaskStats();

  if (!project) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isCreator = user?.id === project.created_by || user?.id === project.manager_id;

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);
      
      if (error) throw error;
      toast({ title: t('statusUpdated') || 'Статус обновлён' });
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: t('errorUpdatingStatus') || 'Ошибка обновления статуса', variant: 'destructive' });
    }
  };

  const statuses: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-xl">{project.title}</DialogTitle>
                {project.description && (
                  <CollapsibleDescription description={project.description} />
                )}
              </div>
              {isCreator ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity",
                      PROJECT_STATUS_COLORS[project.status]
                    )}>
                      {projectStatusLabels[project.status]}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {statuses.map((s) => (
                      <DropdownMenuItem 
                        key={s} 
                        onClick={() => handleStatusChange(s)}
                        className={cn(s === project.status && "bg-accent")}
                      >
                        <span className={cn(
                          "inline-block w-2 h-2 rounded-full mr-2",
                          s === 'planning' && "bg-muted-foreground",
                          s === 'active' && "bg-crm-success",
                          s === 'on_hold' && "bg-crm-warning",
                          s === 'completed' && "bg-primary",
                          s === 'cancelled' && "bg-destructive"
                        )} />
                        {projectStatusLabels[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                  {projectStatusLabels[project.status]}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {isCreator && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('delete')}
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">{t('total')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.done}</div>
                  <div className="text-xs text-muted-foreground">{t('statusDone')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
                  <div className="text-xs text-muted-foreground">{t('statusInProgress')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.todo}</div>
                  <div className="text-xs text-muted-foreground">{t('statusTodo')}</div>
                </CardContent>
              </Card>
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{t('projectTasks')}</h3>
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('add')}
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('noTasksInProject')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: task.color || '#3b82f6' }}
                        />
                        <div>
                          <div className="font-medium text-sm">{task.title}</div>
                          {task.deadline && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(task.deadline), 'd MMM yyyy', { locale: dateLocale })}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[task.status]}>
                        {statusLabels[task.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onSuccess={() => {
          fetchTasks();
          onUpdate();
        }}
        defaultProjectId={project.id}
      />

      <ProjectEditDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          onUpdate();
          setEditOpen(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteProjectConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
