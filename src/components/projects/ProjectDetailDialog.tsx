import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Project, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, Task, STATUS_LABELS, STATUS_COLORS } from '@/types/database';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ProjectDetailDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ProjectDetailDialog = ({ project, open, onOpenChange, onUpdate }: ProjectDetailDialogProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    return { total, done, inProgress, todo };
  };

  const stats = getTaskStats();

  if (!project) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{project.title}</DialogTitle>
                {project.description && (
                  <p className="text-muted-foreground mt-1">{project.description}</p>
                )}
              </div>
              <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Всего</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.done}</div>
                  <div className="text-xs text-muted-foreground">Готово</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
                  <div className="text-xs text-muted-foreground">В работе</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.todo}</div>
                  <div className="text-xs text-muted-foreground">К выполнению</div>
                </CardContent>
              </Card>
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Задачи проекта</h3>
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Нет задач в этом проекте</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTask(task)}
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
                              {format(parseISO(task.deadline), 'd MMM yyyy', { locale: ru })}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[task.status]}>
                        {STATUS_LABELS[task.status]}
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

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onUpdate={() => {
          fetchTasks();
          onUpdate();
        }}
      />
    </>
  );
};
