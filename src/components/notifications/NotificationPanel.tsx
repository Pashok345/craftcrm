import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABEL_KEYS } from '@/lib/notificationPrefs';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  task_id: string | null;
  meeting_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 20;

export const NotificationPanel = ({ open, onOpenChange }: NotificationPanelProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter, showUnreadOnly]);

  useEffect(() => {
    if (user) {
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

  const buildQuery = (from: number) => {
    let q = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    if (showUnreadOnly) q = q.eq('is_read', false);
    return q;
  };

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await buildQuery(0);
    setPage(0);
    setNotifications((data as Notification[]) || []);
    setHasMore((data?.length || 0) === PAGE_SIZE);
  };

  const loadMore = async () => {
    if (!user) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const { data } = await buildQuery(nextPage * PAGE_SIZE);
    setNotifications((prev) => [...prev, ...((data as Notification[]) || [])]);
    setPage(nextPage);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoadingMore(false);
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
      <SheetContent className="w-[400px] sm:w-[450px] p-0 [&>button]:hidden">
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
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
              ✕
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('notifFilterAllTypes')}</SelectItem>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(NOTIFICATION_TYPE_LABEL_KEYS[type])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showUnreadOnly ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowUnreadOnly((v) => !v)}
            >
              {t('notifFilterUnread')}
            </Button>
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="text-xs h-8">
              <Check className="h-3 w-3 mr-1" />
              {t('markAllRead')}
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="text-xs h-8 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />
              {t('delete')}
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-160px)]">
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
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.type === 'meeting' && notification.meeting_id) {
                      onOpenChange(false);
                      navigate(`/meetings?meeting=${notification.meeting_id}`);
                    } else if (notification.task_id) {
                      onOpenChange(false);
                      navigate(`/tasks/${notification.task_id}`);
                    }
                  }}
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
              {hasMore && (
                <div className="p-3">
                  <Button variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loadingMore}>
                    {t('loadMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};