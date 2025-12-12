import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, List, BarChart3 } from 'lucide-react';
import { Task, STATUS_LABELS, STATUS_COLORS, Project } from '@/types/database';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { GanttChart } from '@/components/tasks/GanttChart';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*');
    if (!error && data) {
      const map: Record<string, Project> = {};
      (data as unknown as Project[]).forEach((p) => {
        map[p.id] = p;
      });
      setProjects(map);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Задачи</h1>
          <p className="text-muted-foreground">Управление задачами проекта</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить задачу
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Список
          </TabsTrigger>
          <TabsTrigger value="gantt" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Диаграмма Ганта
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {tasks.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Нет задач</h3>
                <p className="text-muted-foreground mb-4">Создайте первую задачу для начала работы</p>
                <Button onClick={() => setDialogOpen(true)}>Создать задачу</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task, index) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow animate-slide-up"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => handleTaskClick(task)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{task.title}</h3>
                          {task.project_id && projects[task.project_id] && (
                            <Badge variant="outline" className="shrink-0">
                              {projects[task.project_id].title}
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          {task.deadline && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(task.deadline), 'd MMM yyyy', { locale: ru })}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[task.status]}>
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <GanttChart tasks={tasks} onTaskClick={handleTaskClick} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchTasks}
      />

      {selectedTask && (
        <TaskDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          task={selectedTask}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
};

export default Tasks;
