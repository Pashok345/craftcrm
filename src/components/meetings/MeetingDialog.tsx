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
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Profile } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';

interface MeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultStartTime?: string;
  onSuccess: () => void;
}

// Helper to get next valid time (rounded to next 30 min)
const getNextValidTime = (selectedDate: Date | null): string => {
  const now = new Date();
  const isToday = selectedDate ? 
    selectedDate.toDateString() === now.toDateString() : 
    false;
  
  if (!isToday) {
    return '09:00';
  }
  
  // Round up to next 30 minutes
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  let nextHour = currentHour;
  let nextMinute = currentMinute < 30 ? 30 : 0;
  
  if (currentMinute >= 30) {
    nextHour = currentHour + 1;
  }
  
  // If it's past working hours, default to next morning
  if (nextHour >= 23) {
    return '09:00';
  }
  
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
};

const getMinTimeForDate = (selectedDate: Date | undefined): string | undefined => {
  if (!selectedDate) return undefined;
  
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  
  if (!isToday) return undefined;
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  return `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
};

export const MeetingDialog = ({ open, onOpenChange, selectedDate, defaultStartTime, onSuccess }: MeetingDialogProps) => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | undefined>(selectedDate || undefined);
  const [startTime, setStartTime] = useState(() => {
    if (defaultStartTime) return defaultStartTime;
    return getNextValidTime(selectedDate);
  });
  const [endTime, setEndTime] = useState(() => {
    const start = defaultStartTime || getNextValidTime(selectedDate);
    const [h, m] = start.split(':').map(Number);
    return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
  const [timeError, setTimeError] = useState<string | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
      // Update time when date changes
      const newTime = getNextValidTime(selectedDate);
      setStartTime(newTime);
      const [h, m] = newTime.split(':').map(Number);
      setEndTime(`${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (defaultStartTime) {
      // Only use defaultStartTime if it's valid (not in the past for today)
      const minTime = getMinTimeForDate(date);
      if (!minTime || defaultStartTime >= minTime) {
        setStartTime(defaultStartTime);
        const [h, m] = defaultStartTime.split(':').map(Number);
        setEndTime(`${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  }, [defaultStartTime, date]);

  useEffect(() => {
    if (open) {
      fetchUsers();
      // Reset time error when opening
      setTimeError(null);
      // Auto-select creator as participant
      if (user) {
        setParticipants(prev => prev.includes(user.id) ? prev : [user.id]);
      }
    }
  }, [open, user]);

  // Auto-update end time to be 1 hour after start time
  useEffect(() => {
    const [h, m] = startTime.split(':').map(Number);
    const newHour = h + 1;
    if (newHour <= 23) {
      setEndTime(`${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }, [startTime]);

  // Validate time whenever it changes
  useEffect(() => {
    validateTime();
  }, [startTime, date]);

  const validateTime = (): boolean => {
    if (!date) return true;
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      const [h, m] = startTime.split(':').map(Number);
      const meetingTime = new Date(date);
      meetingTime.setHours(h, m, 0, 0);
      
      if (meetingTime < now) {
        setTimeError(t('cannotSchedulePastTime') || 'Нельзя назначить встречу на прошедшее время');
        return false;
      }
    }
    
    setTimeError(null);
    return true;
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data as Profile[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !user) return;
    
    // Final time validation before submit
    if (!validateTime()) {
      toast({ title: t('cannotSchedulePastTime') || 'Нельзя назначить встречу на прошедшее время', variant: 'destructive' });
      return;
    }

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
        
        // Create notifications for each participant
        const notifications = participants.map((userId) => ({
          user_id: userId,
          type: 'meeting_invite',
          title: t('meetingInviteTitle') || 'Приглашение на встречу',
          message: `${t('meetingInviteMessage') || 'Вас пригласили на встречу'} "${title}" ${format(date, 'd MMMM yyyy', { locale: dateLocale })} ${t('at') || 'в'} ${startTime}`,
          created_by: user.id,
        }));
        await supabase.from('notifications').insert(notifications);
        
        // Send emails to participants
        const participantProfiles = users.filter(u => participants.includes(u.user_id));
        for (const participant of participantProfiles) {
          try {
            await supabase.functions.invoke('send-notification-email', {
              body: {
                user_id: participant.user_id,
                type: 'notification',
                title: `Запрошення на зустріч: ${title}`,
                message: `Вас запросили на зустріч "${title}" ${format(date, 'd MMMM yyyy', { locale: dateLocale })} о ${startTime}`,
              },
            });
          } catch (emailError) {
            console.error('Error sending meeting invite email:', emailError);
          }
        }
      }

      toast({ title: t('meetingCreated') || 'Встреча создана' });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({ title: t('errorCreatingMeeting') || 'Ошибка при создании встречи', variant: 'destructive' });
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
          <DialogTitle>{t('createMeeting') || 'Создать встречу'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('meetingTitle') || 'Название встречи'} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('enterTitle') || 'Введите название'}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('description') || 'Описание'}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('describeMeeting') || 'Опишите встречу'}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('date') || 'Дата'} *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: dateLocale }) : t('selectDate') || 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">{t('startTime') || 'Начало'} *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                min={getMinTimeForDate(date)}
                required
                className={timeError ? 'border-destructive' : ''}
              />
              {timeError && (
                <p className="text-xs text-destructive">{timeError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">{t('endTime') || 'Окончание'}</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min={startTime}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('participants') || 'Участники'}</Label>
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
              {t('cancel') || 'Отмена'}
            </Button>
            <Button type="submit" disabled={loading || !title.trim() || !date || !!timeError} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('create') || 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
