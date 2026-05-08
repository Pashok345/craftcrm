import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2, Paperclip, Link2, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Task, TaskStatus, STATUS_LABELS, Profile, Project, TaskLink } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { TaskCustomization, TaskCustomizationValue, emptyCustomization } from '@/components/tasks/TaskCustomization';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TaskEditFormProps {
  task: Task;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TaskEditForm = ({ task, onSuccess, onCancel }: TaskEditFormProps) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [deadline, setDeadline] = useState<Date | undefined>(task.deadline ? new Date(task.deadline) : undefined);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [projectId, setProjectId] = useState<string>(task.project_id || '');
  const [customization, setCustomization] = useState<TaskCustomizationValue>({
    color: task.color || '#3b82f6',
    bgColor: task.bg_color || '',
    bgImageUrl: task.bg_image_url || '',
    accentColor: task.accent_color || '',
    icon: task.icon || '',
    titleFont: task.title_font || '',
    gradient: task.gradient || '',
    headerTitle: (task as any).header_title || '',
  });
  const [links, setLinks] = useState<TaskLink[]>((task.links as TaskLink[]) || []);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<{ id: string; file_name: string; file_url: string }[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [executors, setExecutors] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const [u, p, a, att] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('projects').select('*').order('title'),
        supabase.from('task_assignees').select('*').eq('task_id', task.id),
        supabase.from('task_attachments').select('id, file_name, file_url').eq('task_id', task.id).is('comment_id', null),
      ]);
      if (u.data) setUsers(u.data as Profile[]);
      if (p.data) setProjects(p.data as unknown as Project[]);
      if (a.data) {
        setExecutors(a.data.filter((x) => x.role === 'executor').map((x) => x.user_id));
        setObservers(a.data.filter((x) => x.role === 'observer').map((x) => x.user_id));
      }
      if (att.data) setExistingAttachments(att.data);
    })();
  }, [task.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setLoading(true);
    try {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          title,
          description: description || null,
          deadline: deadline?.toISOString() || null,
          status,
          project_id: projectId || null,
          color: customization.color,
          bg_color: customization.bgColor || null,
          bg_image_url: customization.bgImageUrl || null,
          accent_color: customization.accentColor || null,
          icon: customization.icon || null,
          title_font: customization.titleFont || null,
          gradient: customization.gradient || null,
          header_title: customization.headerTitle || null,
          links: JSON.parse(JSON.stringify(links)),
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      await supabase.from('task_assignees').delete().eq('task_id', task.id);
      const assignees = [
        ...executors.map((userId) => ({ task_id: task.id, user_id: userId, role: 'executor' })),
        ...observers.map((userId) => ({ task_id: task.id, user_id: userId, role: 'observer' })),
      ];
      if (assignees.length > 0) await supabase.from('task_assignees').insert(assignees);

      for (const file of files) {
        const sanitized = file.name.replace(/[^\w.-]/g, '_');
        const fileName = `${task.id}/${Date.now()}-${sanitized}`;
        const { error: uploadError } = await supabase.storage.from('task-attachments').upload(fileName, file);
        if (uploadError) { console.error(uploadError); continue; }
        const { data: signedUrlData } = await supabase.storage.from('task-attachments').createSignedUrl(fileName, 60 * 60 * 24 * 7);
        await supabase.from('task_attachments').insert({
          task_id: task.id,
          file_name: file.name,
          file_url: signedUrlData?.signedUrl || fileName,
          file_type: file.type,
          uploaded_by: user.id,
        });
      }

      toast({ title: 'Задача обновлена' });
      onSuccess();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Ошибка при обновлении задачи', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(userId)) setList(list.filter((id) => id !== userId));
    else setList([...list, userId]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };
  const removeFile = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const addLink = () => {
    if (newLinkUrl.trim()) {
      setLinks([...links, { title: newLinkTitle || newLinkUrl, url: newLinkUrl }]);
      setNewLinkTitle(''); setNewLinkUrl('');
    }
  };
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));

  const deleteAttachment = async (attachmentId: string) => {
    await supabase.from('task_attachments').delete().eq('id', attachmentId);
    setExistingAttachments(existingAttachments.filter((a) => a.id !== attachmentId));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto bg-muted/60 border border-border p-1 gap-1">
          <TabsTrigger value="main" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Основное</TabsTrigger>
          <TabsTrigger value="people" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Участники</TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Файлы и ссылки</TabsTrigger>
          <TabsTrigger value="design" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Кастомизация</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Название *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Дедлайн</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className={cn('w-full justify-start text-left font-normal', !deadline && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, 'd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Выберите проект" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без проекта</SelectItem>
                {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="people" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Исполнители</Label>
              <div className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Checkbox id={`exec-${u.id}`} checked={executors.includes(u.user_id)}
                      onCheckedChange={() => toggleUser(u.user_id, executors, setExecutors)} />
                    <label htmlFor={`exec-${u.id}`} className="text-sm cursor-pointer">{u.name}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Наблюдатели</Label>
              <div className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Checkbox id={`obs-${u.id}`} checked={observers.includes(u.user_id)}
                      onCheckedChange={() => toggleUser(u.user_id, observers, setObservers)} />
                    <label htmlFor={`obs-${u.id}`} className="text-sm cursor-pointer">{u.name}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Link2 className="h-4 w-4" />Ссылки</Label>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">{link.title}</a>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLink(index)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} placeholder="Название" className="flex-1" />
                <Input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="URL" className="flex-1" />
                <Button type="button" variant="outline" size="icon" onClick={addLink} disabled={!newLinkUrl.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Файлы</Label>
            {existingAttachments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Прикреплённые файлы:</p>
                <div className="flex flex-wrap gap-2">
                  {existingAttachments.map((att) => (
                    <Badge key={att.id} variant="secondary" className="flex items-center gap-1">
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{att.file_name}</a>
                      <button type="button" onClick={() => deleteAttachment(att.id)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="outline" className="flex items-center gap-1">
                    {f.name}
                    <button type="button" onClick={() => removeFile(i)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
            <input type="file" id="edit-file-upload-page" className="hidden" multiple onChange={handleFileSelect} />
            <Button type="button" variant="outline" onClick={() => document.getElementById('edit-file-upload-page')?.click()} className="w-full">
              <Paperclip className="h-4 w-4 mr-2" />Добавить файлы
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="design" className="mt-4">
          <TaskCustomization value={customization} onChange={setCustomization} previewTitle={title} uploadFolder={task.id} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit" disabled={loading || !title.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Сохранить
        </Button>
      </div>
    </form>
  );
};
