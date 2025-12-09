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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Profile } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

interface MeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onSuccess: () => void;
}

export const MeetingDialog = ({ open, onOpenChange, selectedDate, onSuccess }: MeetingDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | undefined>(selectedDate || undefined);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [users, setUsers] = useState<Profile[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

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
    if (!title.trim() || !date || !user) return;

    setLoading(true);
    try {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title,
          description: description || null,
          meeting_date: format(date, 'yyyy-MM-dd'),
          start_time: startTime,
          end_time: endTime || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Add participants
      if (participants.length > 0) {
        const participantRecords = participants.map((userId) => ({
          meeting_id: meeting.id,
          user_id: userId,
        }));
        await supabase.from('meeting_participants').insert(participantRecords);
      }

      toast({ title: 'Встреча создана' });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({ title: 'Ошибка при создании встречи', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate(undefined);
    setStartTime('09:00');
    setEndTime('10:00');
    setParticipants([]);
  };

  const toggleParticipant = (userId: string) => {
    setParticipants(
      participants.includes(userId)
        ? participants.filter((id) => id !== userId)
        : [...participants, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать встречу</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название встречи *</Label>
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
              placeholder="Опишите встречу"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Дата *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Начало *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Окончание</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Участники</Label>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
              {users.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={participants.includes(u.user_id)}
                    onCheckedChange={() => toggleParticipant(u.user_id)}
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
            <Button type="submit" disabled={loading || !title.trim() || !date} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
