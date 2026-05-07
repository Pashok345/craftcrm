import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const TASK_COLORS = [
  { value: '#3b82f6', label: 'Синий' },
  { value: '#22c55e', label: 'Зелёный' },
  { value: '#eab308', label: 'Жёлтый' },
  { value: '#f97316', label: 'Оранжевый' },
  { value: '#ef4444', label: 'Красный' },
  { value: '#a855f7', label: 'Фиолетовый' },
  { value: '#ec4899', label: 'Розовый' },
  { value: '#06b6d4', label: 'Голубой' },
];

const BG_COLORS = [
  { value: '', label: 'Нет' },
  { value: '#fef3c7', label: 'Кремовый' },
  { value: '#dbeafe', label: 'Голубой' },
  { value: '#dcfce7', label: 'Мятный' },
  { value: '#fce7f3', label: 'Розовый' },
  { value: '#ede9fe', label: 'Лавандовый' },
  { value: '#fee2e2', label: 'Персиковый' },
  { value: '#f1f5f9', label: 'Серый' },
];

const GRADIENTS = [
  { value: '', label: 'Нет' },
  { value: 'linear-gradient(135deg,#667eea,#764ba2)', label: 'Фиолет' },
  { value: 'linear-gradient(135deg,#f093fb,#f5576c)', label: 'Закат' },
  { value: 'linear-gradient(135deg,#4facfe,#00f2fe)', label: 'Океан' },
  { value: 'linear-gradient(135deg,#43e97b,#38f9d7)', label: 'Свежесть' },
  { value: 'linear-gradient(135deg,#fa709a,#fee140)', label: 'Заря' },
  { value: 'linear-gradient(135deg,#30cfd0,#330867)', label: 'Глубина' },
];

const FONT_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: '"Playfair Display", serif', label: 'Playfair (серифа)' },
  { value: '"Roboto Mono", monospace', label: 'Roboto Mono' },
  { value: '"Comfortaa", cursive', label: 'Comfortaa' },
  { value: '"Bebas Neue", sans-serif', label: 'Bebas Neue' },
  { value: '"Caveat", cursive', label: 'Caveat (рукопись)' },
];

const ICON_OPTIONS = ['', '🚀', '⭐', '🔥', '💡', '✅', '🎯', '📌', '🐛', '⚡', '💎', '🏆', '📈', '🎨', '🛠️'];

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onSuccess: () => void;
}

export const TaskEditDialog = ({ open, onOpenChange, task, onSuccess }: TaskEditDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [projectId, setProjectId] = useState<string>('');
  const [color, setColor] = useState('#3b82f6');
  const [bgColor, setBgColor] = useState<string>('');
  const [bgImageUrl, setBgImageUrl] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('');
  const [icon, setIcon] = useState<string>('');
  const [titleFont, setTitleFont] = useState<string>('');
  const [gradient, setGradient] = useState<string>('');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [links, setLinks] = useState<TaskLink[]>([]);
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
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDeadline(task.deadline ? new Date(task.deadline) : undefined);
      setStatus(task.status);
      setProjectId(task.project_id || '');
      setColor(task.color || '#3b82f6');
      setBgColor(task.bg_color || '');
      setBgImageUrl(task.bg_image_url || '');
      setAccentColor(task.accent_color || '');
      setIcon(task.icon || '');
      setTitleFont(task.title_font || '');
      setGradient(task.gradient || '');
      setLinks((task.links as TaskLink[]) || []);
      fetchUsers();
      fetchProjects();
      fetchAssignees();
      fetchAttachments();
    }
  }, [open, task]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data as Profile[]);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('title');
    if (data) setProjects(data as unknown as Project[]);
  };

  const fetchAssignees = async () => {
    const { data } = await supabase
      .from('task_assignees')
      .select('*')
      .eq('task_id', task.id);

    if (data) {
      setExecutors(data.filter(a => a.role === 'executor').map(a => a.user_id));
      setObservers(data.filter(a => a.role === 'observer').map(a => a.user_id));
    }
  };

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from('task_attachments')
      .select('id, file_name, file_url')
      .eq('task_id', task.id)
      .is('comment_id', null);

    if (data) setExistingAttachments(data);
  };

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
          color,
          bg_color: bgColor || null,
          bg_image_url: bgImageUrl || null,
          accent_color: accentColor || null,
          icon: icon || null,
          title_font: titleFont || null,
          gradient: gradient || null,
          links: JSON.parse(JSON.stringify(links)),
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Update assignees - delete existing and re-insert
      await supabase.from('task_assignees').delete().eq('task_id', task.id);
      
      const assignees = [
        ...executors.map((userId) => ({ task_id: task.id, user_id: userId, role: 'executor' })),
        ...observers.map((userId) => ({ task_id: task.id, user_id: userId, role: 'observer' })),
      ];

      if (assignees.length > 0) {
        await supabase.from('task_assignees').insert(assignees);
      }

      // Upload new files
      for (const file of files) {
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: signedUrlData } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

        await supabase.from('task_attachments').insert({
          task_id: task.id,
          file_name: file.name,
          file_url: signedUrlData?.signedUrl || fileName,
          file_type: file.type,
          uploaded_by: user.id,
        });
      }

      toast({ title: 'Задача обновлена' });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Ошибка при обновлении задачи', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(userId)) {
      setList(list.filter((id) => id !== userId));
    } else {
      setList([...list, userId]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addLink = () => {
    if (newLinkUrl.trim()) {
      setLinks([...links, { title: newLinkTitle || newLinkUrl, url: newLinkUrl }]);
      setNewLinkTitle('');
      setNewLinkUrl('');
    }
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const deleteAttachment = async (attachmentId: string) => {
    await supabase.from('task_attachments').delete().eq('id', attachmentId);
    setExistingAttachments(existingAttachments.filter(a => a.id !== attachmentId));
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingBg(true);
    try {
      const sanitized = file.name.replace(/[^\w.-]/g, '_');
      const path = `${task.id}/bg-${Date.now()}-${sanitized}`;
      const { error: upErr } = await supabase.storage.from('task-attachments').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from('task-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) setBgImageUrl(signed.signedUrl);
      toast({ title: 'Фон загружен' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Ошибка загрузки фона', variant: 'destructive' });
    } finally {
      setUploadingBg(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать задачу</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание задачи"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Дедлайн</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !deadline && 'text-muted-foreground'
                    )}
                  >
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Цвет задачи</Label>
            <div className="flex gap-2 flex-wrap">
              {TASK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без проекта</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Кастомизация задачи */}
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <Label className="text-sm font-semibold">🎨 Кастомизация задачи</Label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Цвет фона карточки</Label>
              <div className="flex gap-2 flex-wrap">
                {BG_COLORS.map((c) => (
                  <button key={c.value || 'none'} type="button"
                    className={cn('w-8 h-8 rounded-md border-2 transition-all flex items-center justify-center text-xs',
                      bgColor === c.value ? 'border-foreground scale-110' : 'border-border')}
                    style={{ backgroundColor: c.value || 'transparent' }}
                    onClick={() => setBgColor(c.value)} title={c.label}>
                    {!c.value && '✕'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Градиент</Label>
              <div className="flex gap-2 flex-wrap">
                {GRADIENTS.map((g) => (
                  <button key={g.value || 'none'} type="button"
                    className={cn('h-8 px-3 rounded-md border-2 transition-all text-xs font-medium',
                      gradient === g.value ? 'border-foreground scale-105' : 'border-border')}
                    style={{ background: g.value || 'hsl(var(--muted))', color: g.value ? '#fff' : 'hsl(var(--muted-foreground))' }}
                    onClick={() => setGradient(g.value)}>{g.label}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Фоновое изображение</Label>
              {bgImageUrl && (
                <div className="relative w-full h-24 rounded-md overflow-hidden border border-border">
                  <img src={bgImageUrl} alt="bg" className="w-full h-full object-cover" />
                  <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => setBgImageUrl('')}><X className="h-3 w-3" /></Button>
                </div>
              )}
              <input type="file" id="bg-upload" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
              <Button type="button" variant="outline" size="sm" disabled={uploadingBg}
                onClick={() => document.getElementById('bg-upload')?.click()}>
                {uploadingBg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                {bgImageUrl ? 'Заменить фото' : 'Загрузить фото'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Акцент (рамка)</Label>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setAccentColor('')}
                    className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs',
                      !accentColor ? 'border-foreground' : 'border-border')}>✕</button>
                  {TASK_COLORS.map((c) => (
                    <button key={c.value} type="button"
                      className={cn('w-7 h-7 rounded-full border-2 transition-all',
                        accentColor === c.value ? 'border-foreground scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setAccentColor(c.value)} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Иконка</Label>
                <div className="flex gap-1 flex-wrap">
                  {ICON_OPTIONS.map((i) => (
                    <button key={i || 'none'} type="button"
                      className={cn('w-7 h-7 rounded-md border-2 transition-all text-base flex items-center justify-center',
                        icon === i ? 'border-foreground bg-muted' : 'border-border')}
                      onClick={() => setIcon(i)}>{i || '✕'}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Шрифт заголовка</Label>
              <Select value={titleFont || '__default__'} onValueChange={(v) => setTitleFont(v === '__default__' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value || '__default__'} value={f.value || '__default__'}>
                      <span style={{ fontFamily: f.value || undefined }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Links section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Ссылки
            </Label>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                    {link.title}
                  </a>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLink(index)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="Название ссылки"
                  className="flex-1"
                />
                <Input
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="URL"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addLink} disabled={!newLinkUrl.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Files section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Файлы
            </Label>
            
            {existingAttachments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Прикреплённые файлы:</p>
                <div className="flex flex-wrap gap-2">
                  {existingAttachments.map((att) => (
                    <Badge key={att.id} variant="secondary" className="flex items-center gap-1">
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {att.file_name}
                      </a>
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
                    <button type="button" onClick={() => removeFile(i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <input
              type="file"
              id="edit-file-upload"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('edit-file-upload')?.click()}
              className="w-full"
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Добавить файлы
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Исполнители</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`exec-edit-${u.id}`}
                      checked={executors.includes(u.user_id)}
                      onCheckedChange={() => toggleUser(u.user_id, executors, setExecutors)}
                    />
                    <label htmlFor={`exec-edit-${u.id}`} className="text-sm cursor-pointer">
                      {u.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Наблюдатели</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`obs-edit-${u.id}`}
                      checked={observers.includes(u.user_id)}
                      onCheckedChange={() => toggleUser(u.user_id, observers, setObservers)}
                    />
                    <label htmlFor={`obs-edit-${u.id}`} className="text-sm cursor-pointer">
                      {u.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
