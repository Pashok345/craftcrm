import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  User,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  History as HistoryIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Project, Task, ProjectStatus, Profile, PROJECT_STATUS_COLORS } from '@/types/database';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { ProjectEditDialog } from '@/components/projects/ProjectEditDialog';
import { format, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { linkifyText } from '@/utils/linkifyText';

interface HistoryEntry {
  id: string;
  user_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const projectStatusLabels: Record<string, string> = {
    planning: t('projectPlanning'),
    active: t('projectActive'),
    on_hold: t('projectOnHold'),
    completed: t('projectCompleted'),
    cancelled: t('projectCancelled'),
  };

  const taskStatusLabels: Record<string, string> = {
    todo: t('statusTodo'),
    in_progress: t('statusInProgress'),
    review: t('statusReview'),
    done: t('statusDone'),
  };

  const STATUS_TASK_COLORS: Record<string, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-crm-warning/10 text-crm-warning',
    review: 'bg-primary/10 text-primary',
    done: 'bg-crm-success/10 text-crm-success',
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [{ data: pData }, { data: tData }, { data: hData }, { data: profData }, { data: mData }] =
        await Promise.all([
          supabase.from('projects').select('*').eq('id', id).maybeSingle(),
          supabase.from('tasks').select('*').eq('project_id', id).order('created_at', { ascending: false }),
          supabase.from('project_history').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(200),
          supabase.from('profiles').select('user_id, name, email, avatar_url, avatar_color'),
          supabase.from('project_members').select('user_id').eq('project_id', id),
        ]);
      setProject(pData as unknown as Project);
      setTasks((tData || []) as unknown as Task[]);
      setHistory((hData || []) as HistoryEntry[]);
      const map: Record<string, Profile> = {};
      (profData || []).forEach((p: any) => { map[p.user_id] = p as Profile; });
      setProfiles(map);
      setMemberIds(((mData || []) as any[]).map(m => m.user_id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((x) => x.status === 'done').length;
    const inProgress = tasks.filter((x) => x.status === 'in_progress').length;
    const review = tasks.filter((x) => x.status === 'review').length;
    const todo = tasks.filter((x) => x.status === 'todo').length;
    const completion = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, review, todo, completion };
  }, [tasks]);

  const statusChartData = useMemo(
    () => [
      { name: t('statusTodo'), value: stats.todo, color: 'hsl(var(--muted-foreground))' },
      { name: t('statusInProgress'), value: stats.inProgress, color: 'hsl(45, 90%, 50%)' },
      { name: t('statusReview'), value: stats.review, color: 'hsl(var(--primary))' },
      { name: t('statusDone'), value: stats.done, color: 'hsl(142, 70%, 45%)' },
    ],
    [stats, t]
  );

  const assigneeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      const aid = (task as any).assignee_id || 'unassigned';
      counts[aid] = (counts[aid] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([uid, value]) => ({
        name: uid === 'unassigned' ? (t('unassigned') || 'Без виконавця') : profiles[uid]?.name || '—',
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tasks, profiles, t]);

  const timelineData = useMemo(() => {
    const buckets: Record<string, { date: string; created: number; completed: number }> = {};
    tasks.forEach((task) => {
      const c = (task.created_at || '').slice(0, 10);
      if (c) {
        buckets[c] = buckets[c] || { date: c, created: 0, completed: 0 };
        buckets[c].created += 1;
      }
      if (task.status === 'done' && (task as any).updated_at) {
        const u = ((task as any).updated_at as string).slice(0, 10);
        buckets[u] = buckets[u] || { date: u, created: 0, completed: 0 };
        buckets[u].completed += 1;
      }
    });
    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks]);

  const logHistory = async (entry: Omit<HistoryEntry, 'id' | 'user_id' | 'created_at'>) => {
    if (!user || !id) return;
    await supabase.from('project_history').insert({
      project_id: id,
      user_id: user.id,
      ...entry,
    });
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return;
    const oldStatus = project.status;
    if (oldStatus === newStatus) return;
    try {
      const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', project.id);
      if (error) throw error;
      await logHistory({
        action: 'status_changed',
        field_name: 'status',
        old_value: oldStatus,
        new_value: newStatus,
      });
      toast({ title: t('statusUpdated') || 'Статус обновлён' });
      load();
    } catch (e) {
      console.error(e);
      toast({ title: t('errorUpdatingStatus') || 'Ошибка обновления статуса', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await supabase.from('projects').delete().eq('id', project.id);
      toast({ title: t('projectDeleted') });
      navigate('/projects');
    } catch (e) {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProjects') || 'Назад до проектів'}
        </Button>
        <p className="text-muted-foreground">{t('projectNotFound') || 'Проект не знайдено'}</p>
      </div>
    );
  }

  const isCreator = user?.id === project.created_by || user?.id === project.manager_id;
  const statuses: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

  const renderHistoryEntry = (h: HistoryEntry) => {
    const author = profiles[h.user_id]?.name || '—';
    const when = format(new Date(h.created_at), 'd MMM yyyy, HH:mm', { locale: dateLocale });
    let text = '';
    if (h.action === 'status_changed') {
      text = `${t('changedStatus') || 'змінив(ла) статус'}: ${projectStatusLabels[h.old_value || ''] || h.old_value} → ${projectStatusLabels[h.new_value || ''] || h.new_value}`;
    } else if (h.action === 'created') {
      text = t('createdProject') || 'створив(ла) проект';
    } else if (h.action === 'updated') {
      text = `${t('updatedField') || 'оновив(ла) поле'} "${h.field_name}"`;
    } else {
      text = h.action;
    }
    return (
      <div key={h.id} className="flex items-start gap-3 py-3 border-b last:border-b-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <HistoryIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{author}</span> {text}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{when}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProjects') || 'Назад'}
        </Button>
        {isCreator && (
          <div className="flex gap-2">
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
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
              {project.description && (
                <p className="mt-2 text-muted-foreground whitespace-pre-wrap">
                  {linkifyText(project.description)}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              {isCreator ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap',
                      PROJECT_STATUS_COLORS[project.status]
                    )}>
                      {projectStatusLabels[project.status]}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {statuses.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)} className={cn(s === project.status && 'bg-accent')}>
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
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {project.manager_id && profiles[project.manager_id] && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{t('manager') || 'Менеджер'}: {profiles[project.manager_id].name}</span>
              </div>
            )}
            {project.budget && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: project.currency || 'USD', maximumFractionDigits: 0 }).format(project.budget)}</span>
              </div>
            )}
            {(project.start_date || project.end_date) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {project.start_date && format(parseISO(project.start_date), 'd MMM', { locale: dateLocale })}
                  {project.start_date && project.end_date && ' – '}
                  {project.end_date && format(parseISO(project.end_date), 'd MMM yyyy', { locale: dateLocale })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('completion') || 'Виконання'}: {stats.completion}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('total'), value: stats.total, color: 'text-foreground' },
          { label: t('statusDone'), value: stats.done, color: 'text-green-600' },
          { label: t('statusInProgress'), value: stats.inProgress, color: 'text-yellow-600' },
          { label: t('statusTodo'), value: stats.todo, color: 'text-blue-600' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <div className={cn('text-3xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">{t('analytics') || 'Аналітика'}</TabsTrigger>
          <TabsTrigger value="tasks">{t('projectTasks')}</TabsTrigger>
          <TabsTrigger value="history">{t('history') || 'Історія'}</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('tasksByStatus') || 'Завдання за статусом'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {statusChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <RTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('tasksByAssignee') || 'Завдання за виконавцями'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assigneeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <RTooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t('activityTimeline') || 'Динаміка'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" name={t('created') || 'Створено'} />
                      <Line type="monotone" dataKey="completed" stroke="hsl(142, 70%, 45%)" name={t('statusDone')} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t('projectTasks')}</h3>
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('add')}
                </Button>
              </div>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('noTasksInProject')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (task as any).color || '#3b82f6' }} />
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
                      <Badge className={STATUS_TASK_COLORS[task.status]}>{taskStatusLabels[task.status]}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-4">
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('noHistory') || 'Немає змін'}</p>
              ) : (
                <div>
                  {history.map(renderHistoryEntry)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onSuccess={load}
        defaultProjectId={project.id}
      />

      <ProjectEditDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          logHistory({ action: 'updated', field_name: 'project', old_value: null, new_value: null });
          load();
          setEditOpen(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteProjectConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectDetail;
