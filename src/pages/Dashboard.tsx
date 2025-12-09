import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, MessageSquare, Clock, Users } from 'lucide-react';

interface Analytics {
  totalTasks: number;
  completedTasks: number;
  totalComments: number;
  totalUsers: number;
}

const Dashboard = () => {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalTasks: 0,
    completedTasks: 0,
    totalComments: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [tasksRes, completedRes, commentsRes, usersRes] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done'),
        supabase.from('task_comments').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      setAnalytics({
        totalTasks: tasksRes.count || 0,
        completedTasks: completedRes.count || 0,
        totalComments: commentsRes.count || 0,
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
      title: 'Всего задач',
      value: analytics.totalTasks,
      icon: CheckSquare,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Выполнено задач',
      value: analytics.completedTasks,
      icon: CheckSquare,
      color: 'bg-crm-success/10 text-crm-success',
    },
    {
      title: 'Сообщений',
      value: analytics.totalComments,
      icon: MessageSquare,
      color: 'bg-crm-warning/10 text-crm-warning',
    },
    {
      title: 'Сотрудников',
      value: analytics.totalUsers,
      icon: Users,
      color: 'bg-accent/10 text-accent',
    },
  ];

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
        <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
        <p className="text-muted-foreground">Обзор вашей CRM системы</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Общее время на задачи
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Статистика по времени будет доступна после добавления задач с оценкой времени
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
