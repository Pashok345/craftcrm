import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, List } from 'lucide-react';
import { Meeting, Profile } from '@/types/database';
import { MeetingDayDialog } from '@/components/meetings/MeetingDayDialog';
import { MeetingDetailDialog } from '@/components/meetings/MeetingDetailDialog';
import { MeetingDialog } from '@/components/meetings/MeetingDialog';
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
  addDays,
  subDays,
} from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface MeetingWithParticipants extends Meeting {
  participants?: Profile[];
}

const Meetings = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [meetings, setMeetings] = useState<MeetingWithParticipants[]>([]);
  const [dayMeetings, setDayMeetings] = useState<MeetingWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>(undefined);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithParticipants | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const weekDays = [
    t('mon'),
    t('tue'),
    t('wed'),
    t('thu'),
    t('fri'),
    t('sat'),
    t('sun'),
  ];

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 - 20:00

  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [currentDate, user]);

  useEffect(() => {
    if (activeTab === 'day' && user) {
      fetchDayMeetings();
    }
  }, [selectedDay, activeTab, user]);

  const fetchMeetings = async () => {
    if (!user) return;
    
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      // Get meetings where user is creator
      const { data: createdMeetings, error: createdError } = await supabase
        .from('meetings')
        .select('*')
        .eq('created_by', user.id)
        .gte('meeting_date', start.toISOString().split('T')[0])
        .lte('meeting_date', end.toISOString().split('T')[0])
        .order('start_time', { ascending: true });

      if (createdError) throw createdError;

      // Get meetings where user is participant
      const { data: participantData, error: participantError } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const participantMeetingIds = participantData?.map(p => p.meeting_id) || [];
      
      let participantMeetings: Meeting[] = [];
      if (participantMeetingIds.length > 0) {
        const { data: invitedMeetings, error: invitedError } = await supabase
          .from('meetings')
          .select('*')
          .in('id', participantMeetingIds)
          .gte('meeting_date', start.toISOString().split('T')[0])
          .lte('meeting_date', end.toISOString().split('T')[0])
          .order('start_time', { ascending: true });

        if (invitedError) throw invitedError;
        participantMeetings = (invitedMeetings || []) as Meeting[];
      }

      // Combine and deduplicate
      const allMeetings = [...(createdMeetings || []), ...participantMeetings];
      const uniqueMeetings = allMeetings.filter((meeting, index, self) =>
        index === self.findIndex(m => m.id === meeting.id)
      );

      setMeetings(uniqueMeetings as MeetingWithParticipants[]);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayMeetings = async () => {
    if (!user) return;
    
    try {
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      
      // Get meetings where user is creator
      const { data: createdMeetings, error: createdError } = await supabase
        .from('meetings')
        .select('*')
        .eq('created_by', user.id)
        .eq('meeting_date', dateStr)
        .order('start_time', { ascending: true });

      if (createdError) throw createdError;

      // Get meetings where user is participant
      const { data: participantData, error: participantError } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const participantMeetingIds = participantData?.map(p => p.meeting_id) || [];
      
      let participantMeetings: Meeting[] = [];
      if (participantMeetingIds.length > 0) {
        const { data: invitedMeetings, error: invitedError } = await supabase
          .from('meetings')
          .select('*')
          .in('id', participantMeetingIds)
          .eq('meeting_date', dateStr)
          .order('start_time', { ascending: true });

        if (invitedError) throw invitedError;
        participantMeetings = (invitedMeetings || []) as Meeting[];
      }

      // Combine and deduplicate
      const allMeetings = [...(createdMeetings || []), ...participantMeetings];
      const uniqueMeetings = allMeetings.filter((meeting, index, self) =>
        index === self.findIndex(m => m.id === meeting.id)
      );

      setDayMeetings(uniqueMeetings as MeetingWithParticipants[]);
    } catch (error) {
      console.error('Error fetching day meetings:', error);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getMeetingsForDay = (date: Date) => {
    return meetings.filter((m) => isSameDay(new Date(m.meeting_date), date));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const getMeetingPosition = (meeting: MeetingWithParticipants) => {
    const [startHour, startMin] = meeting.start_time.split(':').map(Number);
    const top = (startHour - 7) * 60 + startMin;
    
    let height = 60; // default 1 hour
    if (meeting.end_time) {
      const [endHour, endMin] = meeting.end_time.split(':').map(Number);
      height = (endHour - startHour) * 60 + (endMin - startMin);
    }
    
    return { top, height: Math.max(height, 30) };
  };

  const handleMeetingClick = (meeting: MeetingWithParticipants) => {
    setSelectedMeeting(meeting);
    setDetailOpen(true);
  };

  const handleTimeSlotClick = (hour: number, e: React.MouseEvent) => {
    // Check if clicked directly on the time slot area (not on a meeting)
    const target = e.target as HTMLElement;
    if (target.closest('.meeting-item')) return;
    
    // Check if the time slot is in the past
    const now = new Date();
    const slotTime = new Date(selectedDay);
    slotTime.setHours(hour, 0, 0, 0);
    
    if (slotTime < now) return; // Don't allow creating meetings in the past
    
    // Open meeting dialog with pre-filled time
    setDefaultStartTime(`${String(hour).padStart(2, '0')}:00`);
    setCreateDialogOpen(true);
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
          <h1 className="text-2xl font-bold text-foreground">{t('meetingsTitle')}</h1>
          <p className="text-muted-foreground">{t('meetingsDescription')}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addMeeting')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {t('calendarView')}
          </TabsTrigger>
          <TabsTrigger value="day" className="gap-2">
            <List className="h-4 w-4" />
            {t('dayView')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold text-foreground capitalize">
                  {format(currentDate, 'LLLL yyyy', { locale: dateLocale })}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}

                {days.map((day, index) => {
                  const dayMeetingsList = getMeetingsForDay(day);
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
                        {dayMeetingsList.slice(0, 2).map((meeting) => (
                          <div
                            key={meeting.id}
                            className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate"
                          >
                            {meeting.start_time.slice(0, 5)} {meeting.title}
                          </div>
                        ))}
                        {dayMeetingsList.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayMeetingsList.length - 2} {t('more')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedDay(subDays(selectedDay, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold text-foreground">
                  {format(selectedDay, 'EEEE, d MMMM yyyy', { locale: dateLocale })}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedDay(addDays(selectedDay, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative" style={{ height: `${14 * 60}px` }}>
                {/* Time grid - clickable slots */}
                {hours.map((hour, index) => {
                  const now = new Date();
                  const slotTime = new Date(selectedDay);
                  slotTime.setHours(hour, 0, 0, 0);
                  const isPast = slotTime < now;
                  
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "absolute w-full border-t border-border",
                        !isPast && "cursor-pointer hover:bg-primary/5 transition-colors"
                      )}
                      style={{ top: `${(hour - 7) * 60}px`, height: '60px' }}
                      onClick={(e) => handleTimeSlotClick(hour, e)}
                    >
                      {/* Time label positioned between this line and the next one (centered in 60px) */}
                      <div className="absolute left-0 w-14 text-xs text-muted-foreground text-right pr-2" style={{ top: '20px' }}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    </div>
                  );
                })}

                {/* Meetings */}
                <div className="absolute left-16 right-0 top-0 bottom-0 pointer-events-none">
                  {dayMeetings.map((meeting) => {
                    const { top, height } = getMeetingPosition(meeting);
                    return (
                      <div
                        key={meeting.id}
                        className="meeting-item absolute left-1 right-1 bg-primary/10 border-l-4 border-primary rounded-r px-2 py-1 cursor-pointer hover:bg-primary/20 transition-colors overflow-hidden pointer-events-auto"
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => handleMeetingClick(meeting)}
                      >
                        <div className="text-sm font-medium text-primary truncate">
                          {meeting.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {meeting.start_time.slice(0, 5)}
                          {meeting.end_time && ` - ${meeting.end_time.slice(0, 5)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Current time indicator */}
                {isSameDay(selectedDay, new Date()) && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                    style={{
                      top: `${(new Date().getHours() - 7) * 60 + new Date().getMinutes()}px`,
                    }}
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MeetingDayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedDate}
        onSuccess={() => {
          fetchMeetings();
          fetchDayMeetings();
        }}
      />

      <MeetingDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setDefaultStartTime(undefined);
        }}
        selectedDate={activeTab === 'day' ? selectedDay : new Date()}
        defaultStartTime={defaultStartTime}
        onSuccess={() => {
          fetchMeetings();
          fetchDayMeetings();
          setDefaultStartTime(undefined);
        }}
      />

      <MeetingDetailDialog
        meeting={selectedMeeting}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSuccess={() => {
          fetchMeetings();
          fetchDayMeetings();
        }}
      />
    </div>
  );
};

export default Meetings;
