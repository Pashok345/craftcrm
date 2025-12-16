import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      checkDeadlineNotifications();

      // Subscribe to realtime notifications
      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data as Notification[]);
  };

  const checkDeadlineNotifications = async () => {
    if (!user) return;

    // Get tasks assigned to user with deadline within 1 day
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's assigned tasks
    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id);

    if (!assignedTasks || assignedTasks.length === 0) return;

    const taskIds = assignedTasks.map((a) => a.task_id);

    // Get tasks with approaching deadlines
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, deadline')
      .in('id', taskIds)
      .gte('deadline', today.toISOString())
      .lte('deadline', tomorrow.toISOString())
      .neq('status', 'done');

    if (!tasks) return;

    // Check if notifications already exist for these tasks today
    for (const task of tasks) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_id', task.id)
        .eq('type', 'deadline')
        .gte('created_at', today.toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'deadline',
          title: 'Приближается дедлайн',
          message: `Задача "${task.title}" должна быть выполнена до завтра`,
          task_id: task.id,
        });
      }
    }

    fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (notificationId: string) => {
    await supabase.from('notifications').delete().eq('id', notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'deadline':
        return '⏰';
      case 'task_assigned':
        return '📋';
      case 'mention':
        return '@';
      default:
        return '🔔';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Уведомления</h4>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
                <Check className="h-3 w-3 mr-1" />
                Прочитать все
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Нет уведомлений</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 hover:bg-muted/50 transition-colors cursor-pointer',
                    !notification.is_read && 'bg-primary/5'
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-2">
                    <span className="text-lg">{getTypeIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
