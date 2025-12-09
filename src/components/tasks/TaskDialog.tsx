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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskStatus, STATUS_LABELS, Profile } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const TaskDialog = ({ open, onOpenChange, onSuccess }: TaskDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date>();
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [users, setUsers] = useState<Profile[]>([]);
  const [executors, setExecutors] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data as Profile[]);
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
          created_by: user.id,
        })
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
    setExecutors([]);
    setObservers([]);
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
