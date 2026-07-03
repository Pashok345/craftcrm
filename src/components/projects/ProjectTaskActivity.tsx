import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowRight, Activity, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface StatusEntry {
  id: string;
  task_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
}
interface TaskMini { id: string; title: string; updated_at: string; }
interface ProfileMini { user_id: string; name: string | null; avatar_url: string | null; avatar_color: string | null; }

const STATUS_LABEL: Record<string, string> = {
  todo: 'До виконання',
  in_progress: 'В роботі',
  review: 'Перевірка',
  done: 'Готово',
};

const STATUS_COLOR: Record<string, string> = {
  todo: 'bg-slate-200 text-slate-800',
  in_progress: 'bg-amber-100 text-amber-800',
  review: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};

const initials = (n?: string | null) =>
  (n || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

export const ProjectTaskActivity = ({ projectId }: { projectId: string }) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<StatusEntry[]>([]);
  const [recent, setRecent] = useState<TaskMini[]>([]);
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Recent updated tasks in project
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, updated_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(10);
      const t = (tasks || []) as TaskMini[];
      setRecent(t);

      const titles: Record<string, string> = {};
      t.forEach(x => { titles[x.id] = x.title; });

      // task ids in this project (broader set) for history lookup
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('project_id', projectId);
      (allTasks || []).forEach((x: any) => { titles[x.id] = x.title; });
      setTaskTitles(titles);

      const ids = (allTasks || []).map((x: any) => x.id);
      let hist: StatusEntry[] = [];
      if (ids.length) {
        const { data: h } = await supabase
          .from('task_status_history')
          .select('*')
          .in('task_id', ids)
          .order("changed_at", { ascending: false })
          .limit(30);
        hist = (h || []) as StatusEntry[];
      }
      setHistory(hist);

      const userIds = [...new Set(hist.map(x => x.changed_by).filter(Boolean) as string[])];
      if (userIds.length) {
        const { data: p } = await supabase
          .from('public_profiles')
          .select('user_id, name, avatar_url, avatar_color')
          .in('user_id', userIds);
        const map: Record<string, ProfileMini> = {};
        (p || []).forEach((row: any) => { map[row.user_id] = row; });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, [projectId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Останні активні задачі
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
          ) : recent.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Немає задач</p>
          ) : (
            <div className="space-y-2">
              {recent.map(task => (
                <div key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <span className="font-medium text-sm truncate flex-1">{task.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {format(new Date(task.updated_at), 'd MMM HH:mm', { locale: ru })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4" /> Переміщення по колонках
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Немає змін</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {history.map(h => {
                const p = h.changed_by ? profiles[h.changed_by] : undefined;
                return (
                  <div key={h.id}
                    onClick={() => navigate(`/tasks/${h.task_id}`)}
                    className="p-2 rounded-lg border hover:bg-muted/50 cursor-pointer text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      {p && (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: p.avatar_color || '#6366f1' }} className="text-white text-[9px]">
                            {initials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {p?.name || 'Система'} · {format(new Date(h.changed_at), 'd MMM HH:mm', { locale: ru })}
                      </span>
                    </div>
                    <div className="font-medium truncate">{taskTitles[h.task_id] || 'Задача'}</div>
                    <div className="flex items-center gap-1 mt-1 text-xs flex-wrap">
                      {h.old_status && (
                        <Badge variant="secondary" className={STATUS_COLOR[h.old_status] || ''}>
                          {STATUS_LABEL[h.old_status] || h.old_status}
                        </Badge>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className={STATUS_COLOR[h.new_status] || ''}>
                        {STATUS_LABEL[h.new_status] || h.new_status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
