import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  taskId: string;
  userId: string;
  compact?: boolean;
}

/** One-click activity timer, no need to open the time-tracking block. */
export const QuickTimerButton = ({ taskId, userId, compact }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('id, start_time, end_time, user_id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1);
      const active = data?.[0];
      if (!cancelled && active) {
        setActiveId(active.id);
        setStartedAt(active.start_time);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId, userId]);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(differenceInMinutes(new Date(), parseISO(startedAt)));
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ task_id: taskId, user_id: userId, start_time: new Date().toISOString() })
      .select('id, start_time')
      .single();
    setBusy(false);
    if (error || !data) { toast.error('Не удалось запустить таймер'); return; }
    setActiveId(data.id);
    setStartedAt(data.start_time);
    toast.success('Таймер запущен');
  };

  const stop = async () => {
    if (!activeId || !startedAt) return;
    setBusy(true);
    const end = new Date();
    const { error } = await supabase
      .from('time_entries')
      .update({ end_time: end.toISOString(), duration_minutes: differenceInMinutes(end, parseISO(startedAt)) })
      .eq('id', activeId);
    setBusy(false);
    if (error) { toast.error('Не удалось остановить таймер'); return; }
    setActiveId(null);
    setStartedAt(null);
    toast.success('Время сохранено');
  };

  const running = !!activeId;

  return (
    <Button
      variant={running ? 'destructive' : 'outline'}
      size={compact ? 'icon' : 'sm'}
      disabled={busy}
      onClick={running ? stop : start}
      title={running ? 'Остановить таймер' : 'Запустить таймер'}
      aria-label={running ? 'Остановить таймер' : 'Запустить таймер'}
    >
      {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {!compact && <span className="ml-1">{running ? `${elapsed} мин` : 'Таймер'}</span>}
    </Button>
  );
};
