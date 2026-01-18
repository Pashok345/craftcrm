import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Clock, Trash2, Plus } from 'lucide-react';
import { TimeEntry, Profile } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

interface TimeTrackerProps {
  taskId: string;
  userId: string;
}

export const TimeTracker = ({ taskId, userId }: TimeTrackerProps) => {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [isTracking, setIsTracking] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    fetchEntries();
    fetchProfiles();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [taskId]);

  useEffect(() => {
    if (isTracking && activeEntry) {
      intervalRef.current = setInterval(() => {
        const startTime = parseISO(activeEntry.start_time);
        setElapsed(differenceInMinutes(new Date(), startTime));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTracking, activeEntry]);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('task_id', taskId)
      .order('start_time', { ascending: false });
    
    if (!error && data) {
      setEntries(data as unknown as TimeEntry[]);
      const active = data.find(e => !e.end_time);
      if (active && active.user_id === userId) {
        setActiveEntry(active as unknown as TimeEntry);
        setIsTracking(true);
        setElapsed(differenceInMinutes(new Date(), parseISO(active.start_time)));
      }
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('public_profiles').select('*');
    if (data) {
      const map: Record<string, Profile> = {};
      (data as unknown as Profile[]).forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    }
  };

  const startTracking = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: userId,
        start_time: new Date().toISOString(),
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      toast.error(t('error'));
      return;
    }

    setActiveEntry(data as unknown as TimeEntry);
    setIsTracking(true);
    setElapsed(0);
    setDescription('');
    toast.success(t('timerStarted'));
  };

  const stopTracking = async () => {
    if (!activeEntry) return;

    const endTime = new Date();
    const durationMinutes = differenceInMinutes(endTime, parseISO(activeEntry.start_time));

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: endTime.toISOString(),
        duration_minutes: Math.max(1, durationMinutes),
      })
      .eq('id', activeEntry.id);

    if (error) {
      toast.error(t('error'));
      return;
    }

    setIsTracking(false);
    setActiveEntry(null);
    setElapsed(0);
    fetchEntries();
    toast.success(t('timerStopped'));
  };

  const addManualEntry = async () => {
    const minutes = parseInt(manualMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error(t('invalidDuration'));
      return;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    const { error } = await supabase
      .from('time_entries')
      .insert({
        task_id: taskId,
        user_id: userId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: minutes,
        description: description || null,
      });

    if (error) {
      toast.error(t('error'));
      return;
    }

    setManualMinutes('');
    setDescription('');
    setShowManualAdd(false);
    fetchEntries();
    toast.success(t('timeAdded'));
  };

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (!error) {
      fetchEntries();
      toast.success(t('timeEntryDeleted'));
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}${t('hoursShort')} ${mins}${t('minutesShort')}`;
    }
    return `${mins}${t('minutesShort')}`;
  };

  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('timeTracking')}
          </CardTitle>
          <Badge variant="secondary">
            {t('total')}: {formatDuration(totalMinutes)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer Controls */}
        <div className="flex items-center gap-3">
          {isTracking ? (
            <>
              <Button onClick={stopTracking} variant="destructive" size="sm" className="gap-2">
                <Pause className="h-4 w-4" />
                {t('stop')}
              </Button>
              <Badge variant="outline" className="text-lg font-mono">
                {formatDuration(elapsed)}
              </Badge>
            </>
          ) : (
            <>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('whatAreYouWorkingOn')}
                className="flex-1"
              />
              <Button onClick={startTracking} size="sm" className="gap-2">
                <Play className="h-4 w-4" />
                {t('start')}
              </Button>
              <Button 
                onClick={() => setShowManualAdd(!showManualAdd)} 
                variant="outline" 
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Manual Add Form */}
        {showManualAdd && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Input
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              placeholder={t('durationMinutes')}
              type="number"
              className="w-24"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('description')}
              className="flex-1"
            />
            <Button onClick={addManualEntry} size="sm">
              {t('add')}
            </Button>
          </div>
        )}

        {/* Time Entries List */}
        {entries.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {entries.map((entry) => (
              <div 
                key={entry.id} 
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {format(parseISO(entry.start_time), 'd MMM HH:mm', { locale: dateLocale })}
                  </span>
                  <span className="font-medium">
                    {entry.duration_minutes ? formatDuration(entry.duration_minutes) : t('timerInProgress')}
                  </span>
                  {entry.description && (
                    <span className="text-muted-foreground truncate max-w-[150px]">
                      {entry.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {profiles[entry.user_id]?.name}
                  </span>
                  {entry.user_id === userId && entry.end_time && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};