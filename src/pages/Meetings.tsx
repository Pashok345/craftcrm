import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Clock, Users } from 'lucide-react';
import { Meeting, Profile } from '@/types/database';
import { MeetingDayDialog } from '@/components/meetings/MeetingDayDialog';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MeetingWithParticipants extends Meeting {
  participants?: Profile[];
}

const Meetings = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState<MeetingWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchMeetings();
  }, [currentDate]);

  const fetchMeetings = async () => {
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('meeting_date', start.toISOString().split('T')[0])
        .lte('meeting_date', end.toISOString().split('T')[0])
        .order('start_time', { ascending: true });

      if (error) throw error;
      setMeetings((data || []) as MeetingWithParticipants[]);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const getMeetingsForDay = (date: Date) => {
    return meetings.filter((m) => isSameDay(new Date(m.meeting_date), date));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Встречи</h1>
          <p className="text-muted-foreground">Календарь встреч и мероприятий</p>
        </div>
        <Button onClick={() => { setSelectedDate(new Date()); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить встречу
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground capitalize">
              {format(currentDate, 'LLLL yyyy', { locale: ru })}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Week days header */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day, index) => {
              const dayMeetings = getMeetingsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'min-h-24 p-2 border rounded-lg cursor-pointer transition-colors',
                    isCurrentMonth ? 'bg-card hover:bg-muted/50' : 'bg-muted/30',
                    isToday && 'ring-2 ring-primary'
                  )}
                >
                  <div
                    className={cn(
                      'text-sm font-medium mb-1',
                      !isCurrentMonth && 'text-muted-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayMeetings.slice(0, 2).map((meeting) => (
                      <div
                        key={meeting.id}
                        className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate"
                      >
                        {meeting.start_time.slice(0, 5)} {meeting.title}
                      </div>
                    ))}
                    {dayMeetings.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayMeetings.length - 2} ещё
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <MeetingDayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedDate}
        onSuccess={fetchMeetings}
      />
    </div>
  );
};

export default Meetings;
