import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2, Paperclip, X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskStatus, Profile, Project } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { useKanbanColumns, getColumnTitleI18n } from '@/hooks/useKanbanColumns';
import { useLanguage } from '@/contexts/LanguageContext';
import { TaskCustomization, TaskCustomizationValue, emptyCustomization } from '@/components/tasks/TaskCustomization';

interface Props {
  defaultProjectId?: string;
  onSuccess: (taskId?: string) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export const TaskCreateForm = ({ defaultProjectId, onSuccess, onCancel, submitLabel = 'Создать' }: Props) => {
  const { t } = useLanguage();
  const { columns, moveTaskToColumn } = useKanbanColumns();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date>();
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [columnId, setColumnId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [custom, setCustom] = useState<TaskCustomizationValue>(emptyCustomization);
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [executors, setExecutors] = useState<string[]>(user?.id ? [user.id] : []);
  const [observers, setObservers] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: u }, { data: p }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('projects').select('*').order('title'),
      ]);
      if (u) setUsers(u as Profile[]);
      if (p) setProjects(p as unknown as Project[]);
    })();
  }, []);

  useEffect(() => {
    if (columns.length > 0 && !columnId) setColumnId(columns[0].id);
  }, [columns, columnId]);

  useEffect(() => {
    if (user?.id && executors.length === 0) setExecutors([user.id]);
  }, [user?.id]);

  const toggleUser = (userId: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId]);
  };
  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks(prev => [...prev, newSubtask.trim()]);
    setNewSubtask('');
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setLoading(true);
    try {
      const targetCol = columns.find(c => c.id === columnId);
      const finalStatus = (targetCol && ['todo','in_progress','review','done'].includes(targetCol.status))
        ? targetCol.status as TaskStatus : status;

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title,
          description: description || null,
          deadline: deadline?.toISOString() || null,
          status: finalStatus,
          project_id: projectId || null,
          color: custom.color,
          bg_color: custom.bgColor || null,
          bg_image_url: custom.bgImageUrl || null,
          accent_color: custom.accentColor || null,
          icon: custom.icon || null,
          title_font: custom.titleFont || null,
          gradient: custom.gradient || null,
          header_title: custom.headerTitle || null,
          created_by: user.id,
        } as any)
        .select()
        .single();
      if (taskError) throw taskError;

      const assignees = [
        ...executors.map((userId) => ({ task_id: task.id, user_id: userId, role: 'executor' })),
        ...observers.map((userId) => ({ task_id: task.id, user_id: userId, role: 'observer' })),
      ];
      if (assignees.length > 0) await supabase.from('task_assignees').insert(assignees);

      // Notify everyone added to the task (except the creator)
      try {
        const { data: myProfile } = await supabase
          .from('profiles').select('name').eq('user_id', user.id).maybeSingle();
        const recipients = new Set<string>([...executors, ...observers]);
        recipients.delete(user.id);
        for (const userId of recipients) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'task_assigned',
            title: 'Вас добавили в задачу',
            message: `${myProfile?.name || ''}: "${title}"`,
            task_id: task.id,
            created_by: user.id,
          });
        }
      } catch (e) { console.error('Notify on create error:', e); }

      if (subtasks.length > 0) {
        await supabase.from('subtasks').insert(
          subtasks.map((s, i) => ({ task_id: task.id, title: s, sort_order: i, created_by: user.id }))
        );
      }

      for (const file of files) {
        const sanitized = file.name.replace(/[^\w.-]/g, '_');
        const path = `${task.id}/${Date.now()}-${sanitized}`;
        const { error: upErr } = await supabase.storage.from('task-attachments').upload(path, file);
        if (upErr) { console.error(upErr); continue; }
        const { data: signed } = await supabase.storage.from('task-attachments').createSignedUrl(path, 60 * 60 * 24 * 7);
        await supabase.from('task_attachments').insert({
          task_id: task.id, comment_id: null, file_name: file.name,
          file_url: signed?.signedUrl || path, file_type: file.type, uploaded_by: user.id,
        });
      }

      if (targetCol && targetCol.db_id) {
        await moveTaskToColumn({ ...task, status: finalStatus } as any, targetCol, user.id);
      }

      toast({ title: 'Задача создана' });
      onSuccess(task.id);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ title: 'Ошибка при создании задачи', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="main">Основное</TabsTrigger>
          <TabsTrigger value="subtasks">Подзадачи {subtasks.length > 0 && `(${subtasks.length})`}</TabsTrigger>
          <TabsTrigger value="files">Файлы {files.length > 0 && `(${files.length})`}</TabsTrigger>
          <TabsTrigger value="customize">🎨 Дизайн</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название задачи *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Срок</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !deadline && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, 'PPP', { locale: ru }) : 'Дата'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Колонка</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue placeholder="Колонка" /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{getColumnTitleI18n(c, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без проекта</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            Постановщик задачи: <span className="font-medium text-foreground">вы</span> (по умолчанию добавлены в исполнители)
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Исполнители</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                {users.map((u) => (
                  <label key={u.user_id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={executors.includes(u.user_id)} onCheckedChange={() => toggleUser(u.user_id, executors, setExecutors)} />
                    <span className="text-sm">{u.name || u.email}{u.user_id === user?.id ? ' (вы)' : ''}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Наблюдатели</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                {users.map((u) => (
                  <label key={u.user_id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={observers.includes(u.user_id)} onCheckedChange={() => toggleUser(u.user_id, observers, setObservers)} />
                    <span className="text-sm">{u.name || u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subtasks" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Добавить подзадачу"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }} />
            <Button type="button" size="icon" onClick={addSubtask} disabled={!newSubtask.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border rounded">
                <span className="flex-1 text-sm">{s}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => setSubtasks(prev => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {subtasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет подзадач</p>}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-3 mt-4">
          <input type="file" id="new-task-files" multiple className="hidden" onChange={handleFileSelect} />
          <Button type="button" variant="outline" onClick={() => document.getElementById('new-task-files')?.click()} className="w-full">
            <Paperclip className="h-4 w-4 mr-2" /> Добавить файлы и фото
          </Button>
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {f.type.startsWith('image/') ? '🖼️ ' : ''}{f.name}
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="customize" className="mt-4">
          <TaskCustomization value={custom} onChange={setCustom} previewTitle={title} />
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Отмена</Button>
        <Button type="submit" disabled={loading || !title.trim()} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {submitLabel}
        </Button>
      </div>
    </form>
  );
};
