import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Clock, CheckCircle, Users, Folder, Tag as TagIcon, MessageSquare, ListTodo, Calendar, TrendingUp, FileText, User, Download } from 'lucide-react';
import { Task, Project, Profile, TimeEntry, Tag } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { exportToPDF, exportToExcel } from '@/utils/exportReports';
import { toast } from 'sonner';

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
}

interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  role: string;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
}

interface Meeting {
  id: string;
  created_by: string;
  meeting_date: string;
}

interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
}

const Analytics = () => {
  const { t, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [taskTags, setTaskTags] = useState<{ task_id: string; tag_id: string }[]>([]);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<TaskAssignee[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--crm-success))', 'hsl(var(--crm-warning))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        tasksRes, projectsRes, profilesRes, timeRes, tagsRes, taskTagsRes,
        commentsRes, assigneesRes, membersRes, meetingsRes, participantsRes
      ] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('public_profiles').select('*'),
        supabase.from('time_entries').select('*'),
        supabase.from('tags').select('*'),
        supabase.from('task_tags').select('task_id, tag_id'),
        supabase.from('task_comments').select('id, task_id, user_id, created_at'),
        supabase.from('task_assignees').select('id, task_id, user_id, role'),
        supabase.from('project_members').select('id, project_id, user_id, role'),
        supabase.from('meetings').select('id, created_by, meeting_date'),
        supabase.from('meeting_participants').select('id, meeting_id, user_id'),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data as unknown as Task[]);
      if (projectsRes.data) setProjects(projectsRes.data as unknown as Project[]);
      if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
      if (timeRes.data) setTimeEntries(timeRes.data as unknown as TimeEntry[]);
      if (tagsRes.data) setTags(tagsRes.data as unknown as Tag[]);
      if (taskTagsRes.data) setTaskTags(taskTagsRes.data);
      if (commentsRes.data) setTaskComments(commentsRes.data);
      if (assigneesRes.data) setTaskAssignees(assigneesRes.data);
      if (membersRes.data) setProjectMembers(membersRes.data);
      if (meetingsRes.data) setMeetings(meetingsRes.data);
      if (participantsRes.data) setMeetingParticipants(participantsRes.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedProfile = useMemo(() => {
    if (selectedUserId === 'all') return null;
    return profiles.find(p => p.user_id === selectedUserId);
  }, [selectedUserId, profiles]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Filter data by period
  const filterByPeriod = <T extends { created_at?: string; start_time?: string; started_at?: string }>(
    items: T[],
    dateField: keyof T
  ): T[] => {
    if (period === 'all') return items;
    const now = new Date();
    let start: Date, end: Date;
    if (period === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }
    return items.filter(item => {
      const dateValue = item[dateField];
      if (!dateValue || typeof dateValue !== 'string') return false;
      const date = parseISO(dateValue);
      return date >= start && date <= end;
    });
  };

  // User-specific data
  const userTasks = useMemo(() => {
    if (selectedUserId === 'all') return filterByPeriod(tasks, 'created_at');
    const userTaskIds = new Set(
      taskAssignees.filter(a => a.user_id === selectedUserId).map(a => a.task_id)
    );
    const createdByUser = tasks.filter(t => t.created_by === selectedUserId);
    const assignedToUser = tasks.filter(t => userTaskIds.has(t.id));
    const allUserTasks = [...new Map([...createdByUser, ...assignedToUser].map(t => [t.id, t])).values()];
    return filterByPeriod(allUserTasks, 'created_at');
  }, [tasks, taskAssignees, selectedUserId, period]);

  const userProjects = useMemo(() => {
    if (selectedUserId === 'all') return projects;
    const userProjectIds = new Set(
      projectMembers.filter(m => m.user_id === selectedUserId).map(m => m.project_id)
    );
    return projects.filter(p => 
      p.created_by === selectedUserId || 
      p.manager_id === selectedUserId || 
      p.reviewer_id === selectedUserId ||
      userProjectIds.has(p.id)
    );
  }, [projects, projectMembers, selectedUserId]);

  const userTimeEntries = useMemo(() => {
    const entries = selectedUserId === 'all' 
      ? timeEntries 
      : timeEntries.filter(e => e.user_id === selectedUserId);
    return filterByPeriod(entries, 'start_time');
  }, [timeEntries, selectedUserId, period]);

  const userComments = useMemo(() => {
    const comments = selectedUserId === 'all' 
      ? taskComments 
      : taskComments.filter(c => c.user_id === selectedUserId);
    return filterByPeriod(comments, 'created_at');
  }, [taskComments, selectedUserId, period]);

  const userMeetings = useMemo(() => {
    if (selectedUserId === 'all') return meetings;
    const participatingMeetingIds = new Set(
      meetingParticipants.filter(mp => mp.user_id === selectedUserId).map(mp => mp.meeting_id)
    );
    return meetings.filter(m => 
      m.created_by === selectedUserId || participatingMeetingIds.has(m.id)
    );
  }, [meetings, meetingParticipants, selectedUserId]);

  const userTags = useMemo(() => {
    if (selectedUserId === 'all') return tags;
    return tags.filter(tag => tag.created_by === selectedUserId);
  }, [tags, selectedUserId]);

  const userTaskTags = useMemo(() => {
    if (selectedUserId === 'all') return taskTags;
    const userTaskIds = new Set(userTasks.map(t => t.id));
    return taskTags.filter(tt => userTaskIds.has(tt.task_id));
  }, [taskTags, userTasks, selectedUserId]);

  // Stats calculations
  const taskStatusData = useMemo(() => {
    const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    userTasks.forEach(task => {
      statusCounts[task.status]++;
    });
    return [
      { name: t('statusTodo'), value: statusCounts.todo, status: 'todo' },
      { name: t('statusInProgress'), value: statusCounts.in_progress, status: 'in_progress' },
      { name: t('statusReview'), value: statusCounts.review, status: 'review' },
      { name: t('statusDone'), value: statusCounts.done, status: 'done' },
    ].filter(item => item.value > 0);
  }, [userTasks, t]);

  const projectStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    userProjects.forEach(project => {
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
  }, [userProjects, t]);

  const totalTimeMinutes = useMemo(() => {
    return userTimeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  }, [userTimeEntries]);

  const tagUsageData = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    userTaskTags.forEach(tt => {
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
  }, [userTaskTags, tags]);

  // Average task completion time
  const avgCompletionDays = useMemo(() => {
    const completedTasks = userTasks.filter(t => t.status === 'done');
    if (completedTasks.length === 0) return 0;
    const totalDays = completedTasks.reduce((sum, task) => {
      const created = parseISO(task.created_at);
      const updated = parseISO(task.updated_at);
      return sum + differenceInDays(updated, created);
    }, 0);
    return Math.round(totalDays / completedTasks.length);
  }, [userTasks]);

  // Tasks per project chart data
  const tasksPerProjectData = useMemo(() => {
    const projectTaskCounts: Record<string, number> = {};
    userTasks.forEach(task => {
      if (task.project_id) {
        projectTaskCounts[task.project_id] = (projectTaskCounts[task.project_id] || 0) + 1;
      }
    });
    return Object.entries(projectTaskCounts)
      .map(([projectId, count]) => {
        const project = projects.find(p => p.id === projectId);
        return {
          name: project?.title?.substring(0, 15) || 'Unknown',
          value: count,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [userTasks, projects]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}${t('hours')} ${mins}${t('minutes')}` : `${mins}${t('minutes')}`;
  };

  const periodLabels: Record<string, string> = {
    week: t('thisWeek'),
    month: t('thisMonth'),
    all: t('allTime'),
  };

  const getExportTranslations = () => ({
    reportTitle: t('reportTitle'),
    generatedAt: t('generatedAt'),
    period: t('period'),
    user: t('user'),
    allEmployees: t('allEmployees'),
    summary: t('summary'),
    totalTasks: t('totalTasks'),
    completedTasks: t('completedTasks'),
    totalProjects: t('projectsCount'),
    timeTracked: t('timeTracked'),
    avgCompletionDays: t('avgCompletionDays'),
    days: t('days'),
    hours: t('hours'),
    tasksByStatus: t('tasksByStatus'),
    projectsByStatus: t('projectsByStatus'),
    popularTags: t('popularTags'),
    tasksList: t('tasksList'),
    taskTitle: t('tasks'),
    status: t('status'),
    deadline: t('dueDate'),
    createdAt: t('createdAt'),
    projectsList: t('projectsList'),
    projectTitle: t('projects'),
    budget: t('budget'),
    startDate: t('startDate'),
    endDate: t('endDate'),
    timeEntriesList: t('timeEntriesList'),
    date: t('startDate'),
    duration: t('durationMinutes'),
    description: t('description'),
    noDeadline: t('noDeadline'),
    noBudget: t('noBudget'),
    noDescription: t('noDescription'),
    minutes: t('minutesShort'),
  });

  const handleExportPDF = () => {
    exportToPDF({
      tasks: userTasks,
      projects: userProjects,
      profiles,
      timeEntries: userTimeEntries,
      taskStatusData,
      projectStatusData,
      tagUsageData,
      totalTimeMinutes,
      avgCompletionDays,
      period: periodLabels[period],
      selectedUser: selectedProfile?.name || '',
      translations: getExportTranslations(),
    });
    toast.success(t('reportGenerated'));
  };

  const handleExportExcel = () => {
    exportToExcel({
      tasks: userTasks,
      projects: userProjects,
      profiles,
      timeEntries: userTimeEntries,
      taskStatusData,
      projectStatusData,
      tagUsageData,
      totalTimeMinutes,
      avgCompletionDays,
      period: periodLabels[period],
      selectedUser: selectedProfile?.name || '',
      translations: getExportTranslations(),
    });
    toast.success(t('reportGenerated'));
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
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('analyticsTitle')}</h1>
          <p className="text-muted-foreground">{t('analyticsDescription')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* User selector */}
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t('selectEmployee')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{t('allEmployees')}</span>
                </div>
              </SelectItem>
              {profiles.map(profile => (
                <SelectItem key={profile.user_id} value={profile.user_id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback 
                        style={{ backgroundColor: profile.avatar_color || '#6366f1' }}
                        className="text-[10px] text-white"
                      >
                        {getInitials(profile.name || '')}
                      </AvatarFallback>
                    </Avatar>
                    <span>{profile.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period selector */}
          <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month' | 'all')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t('thisWeek')}</SelectItem>
              <SelectItem value="month">{t('thisMonth')}</SelectItem>
              <SelectItem value="all">{t('allTime')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                {t('exportReport')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                {t('exportPDF')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileText className="h-4 w-4 mr-2" />
                {t('exportExcel')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Selected user info */}
      {selectedProfile && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedProfile.avatar_url || undefined} />
                <AvatarFallback 
                  style={{ backgroundColor: selectedProfile.avatar_color || '#6366f1' }}
                  className="text-lg text-white"
                >
                  {getInitials(selectedProfile.name || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{selectedProfile.name}</h3>
                <p className="text-sm text-muted-foreground">{t(`position_${selectedProfile.position}`) || selectedProfile.position}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ListTodo className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('totalTasks')}</p>
                <p className="text-2xl font-bold">{userTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-crm-success/10">
                <CheckCircle className="h-6 w-6 text-crm-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('completedTasks')}</p>
                <p className="text-2xl font-bold">{userTasks.filter(t => t.status === 'done').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-crm-warning/10">
                <Clock className="h-6 w-6 text-crm-warning" />
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
              <div className="p-3 rounded-full bg-destructive/10">
                <Folder className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('projectsCount')}</p>
                <p className="text-2xl font-bold">{userProjects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('commentsCount')}</p>
                <p className="text-2xl font-bold">{userComments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-500/10">
                <Calendar className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('meetingsCount')}</p>
                <p className="text-2xl font-bold">{userMeetings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-pink-500/10">
                <TagIcon className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('tagsCreated')}</p>
                <p className="text-2xl font-bold">{userTags.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-500/10">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('avgCompletionDays')}</p>
                <p className="text-2xl font-bold">{avgCompletionDays} {t('days')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('overviewTab')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('tasks')}</TabsTrigger>
          <TabsTrigger value="time">{t('timeTracking')}</TabsTrigger>
          <TabsTrigger value="tags">{t('tagsAndLabels')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
                <CardTitle>{t('tasksPerProject')}</CardTitle>
              </CardHeader>
              <CardContent>
                {tasksPerProjectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tasksPerProjectData}>
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
                      <Bar dataKey="value" fill="hsl(var(--crm-warning))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">{t('noData')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Task stats summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t('taskStatistics')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-3xl font-bold text-primary">{userTasks.filter(t => t.status === 'todo').length}</p>
                  <p className="text-sm text-muted-foreground">{t('statusTodo')}</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-3xl font-bold text-crm-warning">{userTasks.filter(t => t.status === 'in_progress').length}</p>
                  <p className="text-sm text-muted-foreground">{t('statusInProgress')}</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-3xl font-bold text-purple-500">{userTasks.filter(t => t.status === 'review').length}</p>
                  <p className="text-sm text-muted-foreground">{t('statusReview')}</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-3xl font-bold text-crm-success">{userTasks.filter(t => t.status === 'done').length}</p>
                  <p className="text-sm text-muted-foreground">{t('statusDone')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-3xl font-bold">{formatDuration(totalTimeMinutes)}</p>
                <p className="text-sm text-muted-foreground">{t('totalTimeTracked')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 mx-auto text-crm-success mb-2" />
                <p className="text-3xl font-bold">{userTimeEntries.length}</p>
                <p className="text-sm text-muted-foreground">{t('timeEntriesCount')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-crm-warning mb-2" />
                <p className="text-3xl font-bold">
                  {userTimeEntries.length > 0 
                    ? Math.round(totalTimeMinutes / userTimeEntries.length) 
                    : 0} {t('minutes')}
                </p>
                <p className="text-sm text-muted-foreground">{t('avgEntryDuration')}</p>
              </CardContent>
            </Card>
          </div>

          {userTimeEntries.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noTimeEntries')}</p>
                <p className="text-sm text-muted-foreground mt-2">{t('startTrackingTime')}</p>
              </CardContent>
            </Card>
          )}
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
                    {userTags.map(tag => (
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