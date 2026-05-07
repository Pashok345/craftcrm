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
import { CalendarIcon, Loader2, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskStatus, STATUS_LABELS, Profile, Project } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

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
  { value: '"Playfair Display", serif', label: 'Playfair' },
  { value: '"Roboto Mono", monospace', label: 'Roboto Mono' },
  { value: '"Comfortaa", cursive', label: 'Comfortaa' },
  { value: '"Bebas Neue", sans-serif', label: 'Bebas Neue' },
  { value: '"Caveat", cursive', label: 'Caveat' },
];

const ICON_OPTIONS = ['', '🚀', '⭐', '🔥', '💡', '✅', '🎯', '📌', '🐛', '⚡', '💎', '🏆', '📈', '🎨', '🛠️'];

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultProjectId?: string;
}

export const TaskDialog = ({ open, onOpenChange, onSuccess, defaultProjectId }: TaskDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date>();
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [projectId, setProjectId] = useState<string>('');
  const [color, setColor] = useState('#3b82f6');
  const [bgColor, setBgColor] = useState('');
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [icon, setIcon] = useState('');
  const [titleFont, setTitleFont] = useState('');
  const [gradient, setGradient] = useState('');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [executors, setExecutors] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchProjects();
      // Set default project if provided
      if (defaultProjectId) {
        setProjectId(defaultProjectId);
      }
    } else {
      // Reset form when dialog closes
      resetForm();
    }
  }, [open, defaultProjectId]);

  // Always update projectId when defaultProjectId changes
  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data as Profile[]);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('title');
    if (data) setProjects(data as unknown as Project[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setLoading(true);
    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
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
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (taskError) throw taskError;

      // Add assignees
      const assignees = [
        ...executors.map((userId) => ({ task_id: task.id, user_id: userId, role: 'executor' })),
        ...observers.map((userId) => ({ task_id: task.id, user_id: userId, role: 'observer' })),
      ];

      if (assignees.length > 0) {
        await supabase.from('task_assignees').insert(assignees);
      }

      toast({ title: 'Задача создана' });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ title: 'Ошибка при создании задачи', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDeadline(undefined);
    setStatus('todo');
    setProjectId('');
    setColor('#3b82f6');
    setBgColor('');
    setBgImageUrl('');
    setAccentColor('');
    setIcon('');
    setTitleFont('');
    setGradient('');
    setExecutors([]);
    setObservers([]);
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingBg(true);
    try {
      const sanitized = file.name.replace(/[^\w.-]/g, '_');
      const path = `${user.id}/new-bg-${Date.now()}-${sanitized}`;
      const { error: upErr } = await supabase.storage.from('task-attachments').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from('task-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) setBgImageUrl(signed.signedUrl);
    } catch (err) {
      console.error(err);
      toast({ title: 'Ошибка загрузки фото', variant: 'destructive' });
    } finally {
      setUploadingBg(false);
    }
  };

  const toggleUser = (userId: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать задачу</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название задачи *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите задачу"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Срок выполнения</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !deadline && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, 'PPP', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Цвет на диаграмме</Label>
            <div className="flex flex-wrap gap-2">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Проект</Label>
              <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Без проекта" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без проекта</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <input type="file" id="new-bg-upload" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
              <Button type="button" variant="outline" size="sm" disabled={uploadingBg}
                onClick={() => document.getElementById('new-bg-upload')?.click()}>
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

          <div className="space-y-2">
            <Label>Исполнители</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2">
              {users.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={executors.includes(u.user_id)}
                    onCheckedChange={() => toggleUser(u.user_id, executors, setExecutors)}
                  />
                  <span className="text-sm">{u.name || u.email}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Наблюдатели</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2">
              {users.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={observers.includes(u.user_id)}
                    onCheckedChange={() => toggleUser(u.user_id, observers, setObservers)}
                  />
                  <span className="text-sm">{u.name || u.email}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !title.trim()} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
