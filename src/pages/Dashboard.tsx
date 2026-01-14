import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, MessageSquare, Users, FolderKanban, PlayCircle, Bell, ListChecks, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Analytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  totalProjects: number;
  completedProjects: number;
  totalProcesses: number;
  totalNotifications: number;
  totalUsers: number;
}

const Dashboard = () => {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState<Analytics>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    reviewTasks: 0,
    todoTasks: 0,
    totalProjects: 0,
    completedProjects: 0,
    totalProcesses: 0,
    totalNotifications: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [
        tasksRes,
        completedTasksRes,
        inProgressTasksRes,
        reviewTasksRes,
        todoTasksRes,
        projectsRes,
        completedProjectsRes,
        processesRes,
        notificationsRes,
        usersRes
      ] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'review'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'todo'),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('process_runs').select('id', { count: 'exact', head: true }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      setAnalytics({
        totalTasks: tasksRes.count || 0,
        completedTasks: completedTasksRes.count || 0,
        inProgressTasks: inProgressTasksRes.count || 0,
        reviewTasks: reviewTasksRes.count || 0,
        todoTasks: todoTasksRes.count || 0,
        totalProjects: projectsRes.count || 0,
        completedProjects: completedProjectsRes.count || 0,
        totalProcesses: processesRes.count || 0,
        totalNotifications: notificationsRes.count || 0,
        totalUsers: usersRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: t('totalTasks'),
      value: analytics.totalTasks,
      icon: CheckSquare,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: t('completedTasks'),
      value: analytics.completedTasks,
      icon: ListChecks,
      color: 'bg-crm-success/10 text-crm-success',
    },
    {
      title: t('totalProjects'),
      value: analytics.totalProjects,
      icon: FolderKanban,
      color: 'bg-crm-warning/10 text-crm-warning',
    },
    {
      title: t('completedProjects'),
      value: analytics.completedProjects,
      icon: FolderKanban,
      color: 'bg-crm-success/10 text-crm-success',
    },
    {
      title: t('totalProcesses'),
      value: analytics.totalProcesses,
      icon: PlayCircle,
      color: 'bg-accent/10 text-accent',
    },
    {
      title: t('unreadNotifications'),
      value: analytics.totalNotifications,
      icon: Bell,
      color: 'bg-destructive/10 text-destructive',
    },
    {
      title: t('teamMembers'),
      value: analytics.totalUsers,
      icon: Users,
      color: 'bg-primary/10 text-primary',
    },
  ];

  // Task status pie chart data
  const taskStatusData = [
    { name: t('statusTodo'), value: analytics.todoTasks, color: 'hsl(var(--muted-foreground))' },
    { name: t('statusInProgress'), value: analytics.inProgressTasks, color: 'hsl(var(--crm-warning))' },
    { name: t('statusReview'), value: analytics.reviewTasks, color: 'hsl(var(--primary))' },
    { name: t('statusDone'), value: analytics.completedTasks, color: 'hsl(var(--crm-success))' },
  ].filter(d => d.value > 0);

  // Project status pie chart data
  const projectStatusData = [
    { name: t('planning'), value: analytics.planningProjects, color: 'hsl(var(--muted-foreground))' },
    { name: t('active'), value: analytics.activeProjects, color: 'hsl(var(--crm-warning))' },
    { name: t('onHold'), value: analytics.onHoldProjects, color: 'hsl(var(--primary))' },
    { name: t('completedProjects'), value: analytics.completedProjects, color: 'hsl(var(--crm-success))' },
    { name: t('cancelled'), value: analytics.cancelledProjects, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>
        <p className="text-muted-foreground">{t('overview')}</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat, index) => (
          <Card key={index} className="animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              {t('tasksByStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taskStatusData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ payload }) => {
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
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {taskStatusData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm text-muted-foreground">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                {t('noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overview Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-muted-foreground" />
              {t('overviewComparison')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={overviewData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={80}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="total" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name={t('total')}
                />
                <Bar 
                  dataKey="completed" 
                  fill="hsl(var(--crm-success))" 
                  radius={[0, 4, 4, 0]}
                  name={t('completed')}
                />
                <Legend />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
