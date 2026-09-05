import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { BellPlus, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  entityType: 'task' | 'deal' | 'client' | 'meeting' | 'project';
  entityId: string;
  title: string;
  compact?: boolean;
}

const PRESETS = [
  { label: 'Через 15 минут', minutes: 15 },
  { label: 'Через 1 час', minutes: 60 },
  { label: 'Через 3 часа', minutes: 180 },
  { label: 'Завтра утром', minutes: -1 },
];

const tomorrowMorning = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
};

export const ReminderButton = ({ entityType, entityId, title, compact }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const queryKey = ['reminders', entityType, entityId, user?.id];
  const { data: active = [] } = useQuery({
    queryKey,
    enabled: !!user?.id && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('id, remind_at')
        .eq('user_id', user!.id)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('is_done', false)
        .order('remind_at');
      if (error) throw error;
      return (data || []) as { id: string; remind_at: string }[];
    },
  });

  const create = async (date: Date) => {
    if (!user?.id) return;
    const { error } = await supabase.from('reminders').insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      title,
      remind_at: date.toISOString(),
    });
    if (error) {
      toast.error('Не удалось создать напоминание');
      return;
    }
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['due-reminders'] });
    toast.success(`Напомним ${format(date, 'dd.MM.yyyy HH:mm')}`);
    setOpen(false);
    setCustom('');
  };

  const cancel = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['due-reminders'] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={active.length > 0 ? 'secondary' : 'outline'}
          size={compact ? 'icon' : 'sm'}
          title="Напомнить"
          aria-label="Напомнить"
        >
          <BellPlus className="h-4 w-4" />
          {!compact && <span className="ml-1">Напомнить</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 space-y-1" align="end">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => create(p.minutes < 0 ? tomorrowMorning() : new Date(Date.now() + p.minutes * 60000))}
            className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-accent"
          >
            {p.label}
          </button>
        ))}
        <div className="h-px bg-border my-1" />
        <div className="flex gap-1">
          <Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-8 text-xs" />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!custom}
            onClick={() => custom && create(new Date(custom))}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
        {active.length > 0 && (
          <>
            <div className="h-px bg-border my-1" />
            <p className="text-xs text-muted-foreground px-1">Запланировано:</p>
            {active.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-accent">
                <span>{format(new Date(r.remind_at), 'dd.MM.yyyy HH:mm')}</span>
                <button onClick={() => cancel(r.id)} aria-label="Отменить напоминание">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
