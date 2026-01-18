import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { Clock, CheckCircle, Users, Folder, Tag as TagIcon, TrendingUp } from 'lucide-react';
import { Task, Project, Profile, TimeEntry, Tag } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

const Analytics = () => {
  const { t, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [taskTags, setTaskTags] = useState<{ task_id: string; tag_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--crm-success))', 'hsl(var(--crm-warning))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, projectsRes, profilesRes, timeRes, tagsRes, taskTagsRes] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('public_profiles').select('*'),
        supabase.from('time_entries').select('*'),
        supabase.from('tags').select('*'),
        supabase.from('task_tags').select('task_id, tag_id'),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data as unknown as Task[]);
      if (projectsRes.data) setProjects(projectsRes.data as unknown as Project[]);
      if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
      if (timeRes.data) setTimeEntries(timeRes.data as unknown as TimeEntry[]);
      if (tagsRes.data) setTags(tagsRes.data as unknown as Tag[]);
      if (taskTagsRes.data) setTaskTags(taskTagsRes.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (period === 'all') return tasks;
    const now = new Date();
    let start: Date, end: Date;
    if (period === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }
    return tasks.filter(task => {
      const date = parseISO(task.created_at);
      return date >= start && date <= end;
    });
  }, [tasks, period]);

  const filteredTimeEntries = useMemo(() => {
    if (period === 'all') return timeEntries;
    const now = new Date();
    let start: Date, end: Date;
    if (period === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }
    return timeEntries.filter(entry => {
      const date = parseISO(entry.start_time);
      return date >= start && date <= end;
    });
  }, [timeEntries, period]);

  // Task status distribution
  const taskStatusData = useMemo(() => {
    const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    filteredTasks.forEach(task => {
      statusCounts[task.status]++;
    });
    return [
      { name: t('statusTodo'), value: statusCounts.todo, status: 'todo' },
      { name: t('statusInProgress'), value: statusCounts.in_progress, status: 'in_progress' },
      { name: t('statusReview'), value: statusCounts.review, status: 'review' },
      { name: t('statusDone'), value: statusCounts.done, status: 'done' },
    ].filter(item => item.value > 0);
  }, [filteredTasks, t]);

  // Project status distribution
  const projectStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    projects.forEach(project => {
      statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
    });
    const labels: Record<string, string> = {
      planning: t('projectPlanning'),
      active: t('projectActive'),
      on_hold: t('projectOnHold'),
      completed: t('projectCompleted'),
      cancelled: t('projectCancelled'),
    };
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: labels[status] || status,
      value: count,
    }));
  }, [projects, t]);

  // Time spent per user
  const timeByUserData = useMemo(() => {
    const userTime: Record<string, number> = {};
    filteredTimeEntries.forEach(entry => {
      const minutes = entry.duration_minutes || 0;
      userTime[entry.user_id] = (userTime[entry.user_id] || 0) + minutes;
    });
    return Object.entries(userTime)
      .map(([userId, minutes]) => {
        const profile = profiles.find(p => p.user_id === userId);
        return {
          name: profile?.name || t('noName'),
          hours: Math.round(minutes / 60 * 10) / 10,
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [filteredTimeEntries, profiles, t]);

  // Tag usage
  const tagUsageData = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    taskTags.forEach(tt => {
      tagCounts[tt.tag_id] = (tagCounts[tt.tag_id] || 0) + 1;
    });
    return Object.entries(tagCounts)
      .map(([tagId, count]) => {
        const tag = tags.find(t => t.id === tagId);
        return {
          name: tag?.name || 'Unknown',
          value: count,
          color: tag?.color || '#6366f1',
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [taskTags, tags]);

  // Total time tracked
  const totalTimeMinutes = useMemo(() => {
    return filteredTimeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  }, [filteredTimeEntries]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}${t('hours')} ${mins}${t('minutes')}` : `${mins}${t('minutes')}`;
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
          <h1 className="text-2xl font-bold text-foreground">{t('analyticsTitle')}</h1>
          <p className="text-muted-foreground">{t('analyticsDescription')}</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month' | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{t('thisWeek')}</SelectItem>
            <SelectItem value="month">{t('thisMonth')}</SelectItem>
            <SelectItem value="all">{t('allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('completedTasks')}</p>
                <p className="text-2xl font-bold">{filteredTasks.filter(t => t.status === 'done').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-crm-success/10">
                <Clock className="h-6 w-6 text-crm-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('timeTracked')}</p>
                <p className="text-2xl font-bold">{Math.round(totalTimeMinutes / 60)}{t('hours')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-crm-warning/10">
                <Folder className="h-6 w-6 text-crm-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('activeProjectsCount')}</p>
                <p className="text-2xl font-bold">{projects.filter(p => p.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <TagIcon className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('tagsUsed')}</p>
                <p className="text-2xl font-bold">{tags.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">{t('tasks')}</TabsTrigger>
          <TabsTrigger value="time">{t('timeTracking')}</TabsTrigger>
          <TabsTrigger value="tags">{t('tagsAndLabels')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('tasksByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                {taskStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">{t('noData')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('projectsByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                {projectStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectStatusData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">{t('noData')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('timeByEmployee')}</CardTitle>
            </CardHeader>
            <CardContent>
              {timeByUserData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={timeByUserData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value} ${t('hours')}`, t('timeTracked')]}
                    />
                    <Bar dataKey="hours" fill="hsl(var(--crm-success))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('noTimeEntries')}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t('startTrackingTime')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('popularTags')}</CardTitle>
            </CardHeader>
            <CardContent>
              {tagUsageData.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tagUsageData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {tagUsageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <Badge 
                        key={tag.id} 
                        style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                        variant="outline"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <TagIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('noTags')}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t('createTagsHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;