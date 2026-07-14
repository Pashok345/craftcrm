import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight, History, Loader2, MessageSquare, Paperclip,
  PlusCircle, FileText, ExternalLink, Search,
} from 'lucide-react';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { ru, uk, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { AttachmentImage } from '@/components/ui/attachment-image';
import { isImageFile } from '@/components/ui/image-lightbox';
import { linkifyText } from '@/utils/linkifyText';

type EventType =
  | 'task_created'
  | 'task_status'
  | 'task_comment'
  | 'task_attachment'
  | 'project_comment'
  | 'project_attachment';

interface Event {
  id: string;
  type: EventType;
  at: string;
  userId: string | null;
  taskId?: string;
  taskTitle?: string;
  oldStatus?: string;
  newStatus?: string;
  content?: string;
  fileName?: string;
  fileType?: string | null;
  fileUrl?: string;
  bucket?: 'task-attachments' | 'project-attachments';
  path?: string;
}

interface ProfileMini {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'До виконання',
  in_progress: 'В роботі',
  review: 'Перевірка',
  done: 'Готово',
};

const STATUS_COLOR: Record<string, string> = {
  todo: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  done: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
};

const initials = (n?: string | null) =>
  (n || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const extractStoragePath = (url: string, bucket: string): string | null => {
  const markers = [
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/public/${bucket}/`,
    `/${bucket}/`,
  ];
  for (const m of markers) {
    const i = url.indexOf(m);
    if (i !== -1) return url.substring(i + m.length).split('?')[0];
  }
  return /^https?:/i.test(url) ? null : url;
};

const openFileInNewTab = async (bucket: string, path: string, fileName: string) => {
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      return;
    }
  } catch {}
  // Fallback: download blob
  const { data: blob } = await supabase.storage.from(bucket).download(path);
  if (blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};

export const ProjectHistoryTimeline = ({ projectId }: { projectId: string }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [filter, setFilter] = useState<'all' | EventType>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: tasksData } = await supabase
        .from('tasks').select('id, title, created_at, created_by')
        .eq('project_id', projectId);
      const tasks = (tasksData || []) as Array<{ id: string; title: string; created_at: string; created_by: string | null }>;
      const titleMap: Record<string, string> = {};
      tasks.forEach(t => { titleMap[t.id] = t.title; });
      const taskIds = tasks.map(t => t.id);

      const [histRes, commentsRes, attRes, pCommentsRes, pAttRes] = await Promise.all([
        taskIds.length
          ? supabase.from('task_status_history').select('*').in('task_id', taskIds).order('changed_at', { ascending: false }).limit(200)
          : Promise.resolve({ data: [] as any[] }),
        taskIds.length
          ? supabase.from('task_comments').select('*').in('task_id', taskIds).order('created_at', { ascending: false }).limit(200)
          : Promise.resolve({ data: [] as any[] }),
        taskIds.length
          ? supabase.from('task_attachments').select('*').in('task_id', taskIds).order('created_at', { ascending: false }).limit(200)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('project_comments').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(200),
        supabase.from('project_attachments').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(200),
      ]);

      const merged: Event[] = [];

      tasks.forEach(t => {
        merged.push({
          id: `task-${t.id}`,
          type: 'task_created',
          at: t.created_at,
          userId: t.created_by,
          taskId: t.id,
          taskTitle: t.title,
        });
      });

      (histRes.data || []).forEach((h: any) => {
        merged.push({
          id: `hist-${h.id}`,
          type: 'task_status',
          at: h.changed_at,
          userId: h.changed_by,
          taskId: h.task_id,
          taskTitle: titleMap[h.task_id] || 'Задача',
          oldStatus: h.old_status,
          newStatus: h.new_status,
        });
      });

      (commentsRes.data || []).forEach((c: any) => {
        merged.push({
          id: `tc-${c.id}`,
          type: 'task_comment',
          at: c.created_at,
          userId: c.user_id,
          taskId: c.task_id,
          taskTitle: titleMap[c.task_id] || 'Задача',
          content: c.content,
        });
      });

      (attRes.data || []).forEach((a: any) => {
        merged.push({
          id: `ta-${a.id}`,
          type: 'task_attachment',
          at: a.created_at,
          userId: a.uploaded_by,
          taskId: a.task_id,
          taskTitle: titleMap[a.task_id] || 'Задача',
          fileName: a.file_name,
          fileType: a.file_type,
          fileUrl: a.file_url,
          bucket: 'task-attachments',
          path: extractStoragePath(a.file_url || '', 'task-attachments') || undefined,
        });
      });

      (pCommentsRes.data || []).forEach((c: any) => {
        merged.push({
          id: `pc-${c.id}`,
          type: 'project_comment',
          at: c.created_at,
          userId: c.user_id,
          content: c.content,
        });
      });

      (pAttRes.data || []).forEach((a: any) => {
        merged.push({
          id: `pa-${a.id}`,
          type: 'project_attachment',
          at: a.created_at,
          userId: a.uploaded_by,
          fileName: a.file_name,
          fileType: a.file_type,
          bucket: 'project-attachments',
          path: a.file_path,
        });
      });

      merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      const userIds = Array.from(new Set(merged.map(e => e.userId).filter(Boolean) as string[]));
      let profMap: Record<string, ProfileMini> = {};
      if (userIds.length) {
        const { data: pData } = await supabase
          .from('public_profiles')
          .select('user_id, name, avatar_url, avatar_color')
          .in('user_id', userIds);
        (pData || []).forEach((p: any) => { profMap[p.user_id] = p; });
      }

      if (cancelled) return;
      setProfiles(profMap);
      setEvents(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filter !== 'all' && e.type !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${e.taskTitle || ''} ${e.content || ''} ${e.fileName || ''} ${profiles[e.userId || '']?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, filter, query, profiles]);

  // Group by day
  const groups = useMemo(() => {
    const g: { label: string; items: Event[] }[] = [];
    filtered.forEach(e => {
      const d = new Date(e.at);
      const last = g[g.length - 1];
      if (last && isSameDay(new Date(last.items[0].at), d)) {
        last.items.push(e);
      } else {
        let label = format(d, 'd MMMM yyyy', { locale: dateLocale });
        if (isToday(d)) label = `Сьогодні · ${format(d, 'd MMMM', { locale: dateLocale })}`;
        else if (isYesterday(d)) label = `Вчора · ${format(d, 'd MMMM', { locale: dateLocale })}`;
        g.push({ label, items: [e] });
      }
    });
    return g;
  }, [filtered, dateLocale]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Історія проекту
            {!loading && (
              <Badge variant="secondary" className="ml-1">{events.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук…"
                className="h-8 pl-7 w-48"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="h-8 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі події</SelectItem>
                <SelectItem value="task_created">Створення задач</SelectItem>
                <SelectItem value="task_status">Зміна статусу</SelectItem>
                <SelectItem value="task_comment">Коментарі задач</SelectItem>
                <SelectItem value="task_attachment">Файли задач</SelectItem>
                <SelectItem value="project_comment">Коментарі проекту</SelectItem>
                <SelectItem value="project_attachment">Файли проекту</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Немає подій</p>
        ) : (
          <div className="space-y-6 max-h-[560px] overflow-y-auto pr-1">
            {groups.map(group => (
              <div key={group.label}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-1 mb-2 border-b">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </h4>
                </div>
                <div className="space-y-2">
                  {group.items.map(ev => (
                    <EventRow
                      key={ev.id}
                      ev={ev}
                      profile={ev.userId ? profiles[ev.userId] : undefined}
                      dateLocale={dateLocale}
                      onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const EventRow = ({
  ev, profile, dateLocale, onOpenTask,
}: {
  ev: Event;
  profile?: ProfileMini;
  dateLocale: any;
  onOpenTask: (id: string) => void;
}) => {
  const time = format(new Date(ev.at), 'HH:mm', { locale: dateLocale });

  const Icon = () => {
    const wrap = 'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0';
    switch (ev.type) {
      case 'task_created':
        return <div className={`${wrap} bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300`}><PlusCircle className="h-4 w-4" /></div>;
      case 'task_status':
        return <div className={`${wrap} bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`}><ArrowRight className="h-4 w-4" /></div>;
      case 'task_comment':
      case 'project_comment':
        return <div className={`${wrap} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300`}><MessageSquare className="h-4 w-4" /></div>;
      case 'task_attachment':
      case 'project_attachment':
        return <div className={`${wrap} bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300`}><Paperclip className="h-4 w-4" /></div>;
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors">
      <Icon />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {profile ? (
            <Avatar className="h-5 w-5">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback style={{ backgroundColor: profile.avatar_color || '#6366f1' }} className="text-white text-[9px]">
                {initials(profile.name)}
              </AvatarFallback>
            </Avatar>
          ) : null}
          <span className="font-medium text-foreground">{profile?.name || 'Система'}</span>
          <span>·</span>
          <span>{time}</span>
        </div>

        {ev.type === 'task_created' && ev.taskId && (
          <div className="text-sm">
            Створив(ла) задачу{' '}
            <button onClick={() => onOpenTask(ev.taskId!)} className="font-medium text-primary hover:underline">
              {ev.taskTitle}
            </button>
          </div>
        )}

        {ev.type === 'task_status' && ev.taskId && (
          <div className="space-y-1.5">
            <div className="text-sm">
              Перемістив(ла) задачу{' '}
              <button onClick={() => onOpenTask(ev.taskId!)} className="font-medium text-primary hover:underline">
                {ev.taskTitle}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {ev.oldStatus && (
                <Badge variant="secondary" className={STATUS_COLOR[ev.oldStatus] || ''}>
                  {STATUS_LABEL[ev.oldStatus] || ev.oldStatus}
                </Badge>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <Badge variant="secondary" className={STATUS_COLOR[ev.newStatus || ''] || ''}>
                {STATUS_LABEL[ev.newStatus || ''] || ev.newStatus}
              </Badge>
            </div>
          </div>
        )}

        {ev.type === 'task_comment' && ev.taskId && (
          <div className="space-y-1">
            <div className="text-sm">
              Прокоментував(ла){' '}
              <button onClick={() => onOpenTask(ev.taskId!)} className="font-medium text-primary hover:underline">
                {ev.taskTitle}
              </button>
            </div>
            {ev.content && <CommentBody text={ev.content} />}
          </div>
        )}

        {ev.type === 'project_comment' && (
          <div className="space-y-1">
            <div className="text-sm">Додав(ла) коментар до проекту</div>
            {ev.content && <CommentBody text={ev.content} />}
          </div>
        )}


        {(ev.type === 'task_attachment' || ev.type === 'project_attachment') && (
          <AttachmentEvent ev={ev} onOpenTask={onOpenTask} />
        )}
      </div>
    </div>
  );
};

const AttachmentEvent = ({
  ev, onOpenTask,
}: {
  ev: Event;
  onOpenTask: (id: string) => void;
}) => {
  const isImg = isImageFile(ev.fileType || null, ev.fileName || '');
  const bucket = ev.bucket || 'task-attachments';

  return (
    <div className="space-y-2">
      <div className="text-sm">
        Додав(ла) файл{' '}
        {ev.taskId && (
          <>
            до задачі{' '}
            <button onClick={() => onOpenTask(ev.taskId!)} className="font-medium text-primary hover:underline">
              {ev.taskTitle}
            </button>
          </>
        )}
        {!ev.taskId && 'до проекту'}
      </div>

      {isImg ? (
        <div className="max-w-[220px]">
          <AttachmentImage
            fileUrl={ev.fileUrl || ev.path || ''}
            fileName={ev.fileName || 'image'}
            bucket={bucket}
          />
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/40 max-w-full">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">{ev.fileName}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => ev.path && openFileInNewTab(bucket, ev.path, ev.fileName || 'file')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Відкрити
          </Button>
        </div>
      )}
    </div>
  );
};
