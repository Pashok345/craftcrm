import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  task_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationPanel = ({ open, onOpenChange }: NotificationPanelProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (user) {
      fetchNotifications();
      checkDeadlineNotifications();

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

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id);

    if (!assignedTasks || assignedTasks.length === 0) return;

    const taskIds = assignedTasks.map((a) => a.task_id);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, deadline')
      .in('id', taskIds)
      .gte('deadline', today.toISOString())
      .lte('deadline', tomorrow.toISOString())
      .neq('status', 'done');

    if (!tasks) return;

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
      case 'message':
        return '✉️';
      default:
        return '🔔';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('notifications')}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                {t('markAllRead')}
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll} className="text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3 mr-1" />
                {t('delete')}
              </Button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">{t('noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-muted/50 transition-colors cursor-pointer group',
                    !notification.is_read && 'bg-primary/5'
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    <span className="text-xl">{getTypeIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
