import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFavorites } from '@/hooks/useFavorites';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CheckSquare, Users, FolderKanban, PlayCircle, Bell, ListChecks, Star, Activity, Settings2, GripVertical, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';

interface WidgetConfig {
  id: string;
  widget_type: string;
  sort_order: number;
  is_visible: boolean;
  width: string;
}

interface Analytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  totalProjects: number;
  completedProjects: number;
  planningProjects: number;
  activeProjects: number;
  onHoldProjects: number;
  cancelledProjects: number;
  totalProcesses: number;
  totalNotifications: number;
  totalUsers: number;
}

const ALL_WIDGET_TYPES = [
  'stats',
  'task_chart',
  'project_chart',
  'favorites',
  'recent_tasks',
];

const WIDGET_LABELS: Record<string, Record<string, string>> = {
  stats: { ru: 'Статистика', en: 'Statistics', uk: 'Статистика' },
  task_chart: { ru: 'Задачи по статусу', en: 'Tasks by status', uk: 'Завдання за статусом' },
  project_chart: { ru: 'Проекты по статусу', en: 'Projects by status', uk: 'Проекти за статусом' },
  favorites: { ru: 'Избранное', en: 'Favorites', uk: 'Обране' },
  recent_tasks: { ru: 'Последние задачи', en: 'Recent tasks', uk: 'Останні завдання' },
};

const WIDGET_ICONS: Record<string, React.ElementType> = {
  stats: Activity,
  task_chart: CheckSquare,
  project_chart: FolderKanban,
  favorites: Star,
  recent_tasks: ListChecks,
};

export const DashboardWidgets = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [editing, setEditing] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [favoriteEntities, setFavoriteEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load widget configs
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');

      if (data && data.length > 0) {
        setWidgets(data as WidgetConfig[]);
      } else {
        // Create default widgets
        const defaults = ALL_WIDGET_TYPES.map((type, i) => ({
          user_id: user.id,
          widget_type: type,
          sort_order: i,
          is_visible: true,
          width: type === 'stats' ? 'full' : 'half',
        }));
        const { data: created } = await supabase
          .from('dashboard_widgets')
          .insert(defaults)
          .select();
        if (created) setWidgets(created as WidgetConfig[]);
      }
    };
    load();
  }, [user]);

  // Load analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [
          tasksRes, completedRes, inProgressRes, reviewRes, todoRes,
          projectsRes, completedProjRes, planningRes, activeRes, onHoldRes, cancelledRes,
          processesRes, notifsRes, usersRes,
        ] = await Promise.all([
          supabase.from('tasks').select('id', { count: 'exact', head: true }),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done'),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'review'),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'todo'),
          supabase.from('projects').select('id', { count: 'exact', head: true }),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'planning'),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'on_hold'),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
          supabase.from('process_runs').select('id', { count: 'exact', head: true }),
          supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
        ]);
        setAnalytics({
          totalTasks: tasksRes.count || 0,
          completedTasks: completedRes.count || 0,
          inProgressTasks: inProgressRes.count || 0,
          reviewTasks: reviewRes.count || 0,
          todoTasks: todoRes.count || 0,
          totalProjects: projectsRes.count || 0,
          completedProjects: completedProjRes.count || 0,
          planningProjects: planningRes.count || 0,
          activeProjects: activeRes.count || 0,
          onHoldProjects: onHoldRes.count || 0,
          cancelledProjects: cancelledRes.count || 0,
          totalProcesses: processesRes.count || 0,
          totalNotifications: notifsRes.count || 0,
          totalUsers: usersRes.count || 0,
        });
      } catch (e) {
        console.error(e);
      }
    };
    fetchAnalytics();
  }, []);

  // Load recent tasks
  useEffect(() => {
    supabase
      .from('tasks')
      .select('id, title, status, deadline')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentTasks(data || []));
  }, []);

  // Load favorite entities
  useEffect(() => {
    const loadFavEntities = async () => {
      if (favorites.length === 0) {
        setFavoriteEntities([]);
        setLoading(false);
        return;
      }
      const taskFavs = favorites.filter((f) => f.entity_type === 'task');
      const projectFavs = favorites.filter((f) => f.entity_type === 'project');
      const clientFavs = favorites.filter((f) => f.entity_type === 'client');

      const entities: any[] = [];

      if (taskFavs.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status')
          .in('id', taskFavs.map((f) => f.entity_id));
        (data || []).forEach((t) => entities.push({ ...t, _type: 'task' }));
      }
      if (projectFavs.length > 0) {
        const { data } = await supabase
          .from('projects')
          .select('id, title, status')
          .in('id', projectFavs.map((f) => f.entity_id));
        (data || []).forEach((p) => entities.push({ ...p, _type: 'project' }));
      }
      if (clientFavs.length > 0) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, company')
          .in('id', clientFavs.map((f) => f.entity_id));
        (data || []).forEach((c) => entities.push({ ...c, title: c.name, _type: 'client' }));
      }

      setFavoriteEntities(entities);
      setLoading(false);
    };
    loadFavEntities();
  }, [favorites]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(widgets);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const updated = items.map((w, i) => ({ ...w, sort_order: i }));
    setWidgets(updated);

    // Save to DB
    for (const w of updated) {
      await supabase
        .from('dashboard_widgets')
        .update({ sort_order: w.sort_order })
        .eq('id', w.id);
    }
  };

  const toggleWidget = async (widgetId: string, visible: boolean) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, is_visible: visible } : w))
    );
    await supabase
      .from('dashboard_widgets')
      .update({ is_visible: visible })
      .eq('id', widgetId);
  };

  const visibleWidgets = widgets.filter((w) => w.is_visible);

  const stats = analytics
    ? [
        { title: t('totalTasks'), value: analytics.totalTasks, icon: CheckSquare, color: 'bg-primary/10 text-primary' },
        { title: t('completedTasks'), value: analytics.completedTasks, icon: ListChecks, color: 'bg-crm-success/10 text-crm-success' },
        { title: t('totalProjects'), value: analytics.totalProjects, icon: FolderKanban, color: 'bg-crm-warning/10 text-crm-warning' },
        { title: t('totalProcesses'), value: analytics.totalProcesses, icon: PlayCircle, color: 'bg-accent/10 text-accent' },
        { title: t('unreadNotifications'), value: analytics.totalNotifications, icon: Bell, color: 'bg-destructive/10 text-destructive' },
        { title: t('teamMembers'), value: analytics.totalUsers, icon: Users, color: 'bg-primary/10 text-primary' },
      ]
    : [];

  const taskStatusData = analytics
    ? [
        { name: t('statusTodo'), value: analytics.todoTasks, color: 'hsl(var(--muted-foreground))' },
        { name: t('statusInProgress'), value: analytics.inProgressTasks, color: 'hsl(var(--crm-warning))' },
        { name: t('statusReview'), value: analytics.reviewTasks, color: 'hsl(var(--primary))' },
        { name: t('statusDone'), value: analytics.completedTasks, color: 'hsl(var(--crm-success))' },
      ].filter((d) => d.value > 0)
    : [];

  const projectStatusData = analytics
    ? [
        { name: t('planning'), value: analytics.planningProjects, color: 'hsl(var(--muted-foreground))' },
        { name: t('active'), value: analytics.activeProjects, color: 'hsl(var(--crm-warning))' },
        { name: t('onHold'), value: analytics.onHoldProjects, color: 'hsl(var(--primary))' },
        { name: t('completedProjects'), value: analytics.completedProjects, color: 'hsl(var(--crm-success))' },
        { name: t('cancelled'), value: analytics.cancelledProjects, color: 'hsl(var(--destructive))' },
      ].filter((d) => d.value > 0)
    : [];

  const STATUS_COLORS: Record<string, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-crm-warning/10 text-crm-warning',
    review: 'bg-primary/10 text-primary',
    done: 'bg-crm-success/10 text-crm-success',
  };

  const STATUS_LABELS_MAP: Record<string, Record<string, string>> = {
    todo: { ru: 'К выполнению', en: 'To Do', uk: 'До виконання' },
    in_progress: { ru: 'В работе', en: 'In Progress', uk: 'В роботі' },
    review: { ru: 'На проверке', en: 'In Review', uk: 'На перевірці' },
    done: { ru: 'Выполнено', en: 'Done', uk: 'Виконано' },
  };

  const getStatusLabel = (status: string) => STATUS_LABELS_MAP[status]?.[language] || status;

  const renderWidget = (widget: WidgetConfig) => {
    switch (widget.widget_type) {
      case 'stats':
        return (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground truncate pr-2">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg shrink-0 ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'task_chart':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckSquare className="h-5 w-5 text-muted-foreground" />
                {t('tasksByStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taskStatusData.length > 0 ? (
                <div className="flex flex-col">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                          {taskStatusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={({ payload }) => {
                          if (payload && payload.length > 0) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p className="text-muted-foreground">{data.value} {t('tasks').toLowerCase()}</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center pt-4 border-t">
                    {taskStatusData.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-muted-foreground">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">{t('noData')}</div>
              )}
            </CardContent>
          </Card>
        );

      case 'project_chart':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                {t('projectsByStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectStatusData.length > 0 ? (
                <div className="flex flex-col">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                          {projectStatusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={({ payload }) => {
                          if (payload && payload.length > 0) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p className="text-muted-foreground">{data.value} {t('projects').toLowerCase()}</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center pt-4 border-t">
                    {projectStatusData.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-muted-foreground truncate max-w-[100px]">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">{t('noData')}</div>
              )}
            </CardContent>
          </Card>
        );

      case 'favorites':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-yellow-400" />
                {WIDGET_LABELS.favorites[language] || 'Избранное'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favoriteEntities.length > 0 ? (
                <div className="space-y-2">
                  {favoriteEntities.slice(0, 8).map((entity) => (
                    <div
                      key={`${entity._type}-${entity.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (entity._type === 'task') navigate(`/tasks/${entity.id}`);
                        else if (entity._type === 'project') navigate('/projects');
                        else if (entity._type === 'client') navigate('/sales');
                      }}
                    >
                      {entity._type === 'task' && <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />}
                      {entity._type === 'project' && <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />}
                      {entity._type === 'client' && <Users className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm truncate">{entity.title}</span>
                      {entity.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ml-auto shrink-0 ${STATUS_COLORS[entity.status] || 'bg-muted text-muted-foreground'}`}>
                          {entity.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                  {t('noFavorites') || 'Нет избранных элементов'}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'recent_tasks':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListChecks className="h-5 w-5 text-muted-foreground" />
                {WIDGET_LABELS.recent_tasks[language] || 'Последние задачи'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTasks.length > 0 ? (
                <div className="space-y-2">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{task.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-auto shrink-0 ${STATUS_COLORS[task.status] || 'bg-muted'}`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                  {t('noData')}
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>
          <p className="text-muted-foreground">{t('overview')}</p>
        </div>
        <Button
          variant={editing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditing(!editing)}
          className="gap-2"
        >
          {editing ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
          {editing ? (t('done') || 'Готово') : (t('customize') || 'Настроить')}
        </Button>
      </div>

      {editing && (
        <Card className="p-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {t('toggleWidgets') || 'Включить/выключить виджеты'}
            </p>
            {widgets.map((w) => (
              <div key={w.id} className="flex items-center justify-between">
                <span className="text-sm">{WIDGET_LABELS[w.widget_type]?.[language] || w.widget_type}</span>
                <Switch
                  checked={w.is_visible}
                  onCheckedChange={(checked) => toggleWidget(w.id, checked)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-widgets">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
              {visibleWidgets.map((widget, index) => (
                <Draggable
                  key={widget.id}
                  draggableId={widget.id}
                  index={index}
                  isDragDisabled={!editing}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? 'opacity-80' : ''}
                    >
                      <div className="relative">
                        {editing && (
                          <div
                            {...provided.dragHandleProps}
                            className="absolute -left-2 top-4 z-10 cursor-grab active:cursor-grabbing p-1 rounded bg-muted"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className={editing ? 'ml-6' : ''}>
                          {renderWidget(widget)}
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
