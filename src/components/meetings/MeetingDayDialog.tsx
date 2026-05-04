import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Clock, Users, ChevronRight } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Meeting, Profile } from '@/types/database';
import { MeetingDialog } from './MeetingDialog';
import { MeetingDetailDialog } from './MeetingDetailDialog';

interface MeetingWithParticipants extends Meeting {
  participants?: Profile[];
}

interface MeetingDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onSuccess: () => void;
}

export const MeetingDayDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSuccess,
}: MeetingDayDialogProps) => {
  const [meetings, setMeetings] = useState<MeetingWithParticipants[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithParticipants | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (open && selectedDate) {
      fetchMeetingsForDay();
    }
  }, [open, selectedDate]);

  const fetchMeetingsForDay = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Non-recurring meetings on the day + recurring meetings whose base date <= day
      const [{ data: regular, error: e1 }, { data: recurring, error: e2 }] = await Promise.all([
        supabase
          .from('meetings')
          .select('*')
          .eq('meeting_date', dateStr)
          .order('start_time', { ascending: true }),
        supabase
          .from('meetings')
          .select('*')
          .not('recurrence_rule', 'is', null)
          .lte('meeting_date', dateStr)
          .order('start_time', { ascending: true }),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;

      const merged = [
        ...(regular || []),
        ...(recurring || []).filter((r) => !(regular || []).some((m) => m.id === r.id)),
      ];

      const expanded = expandRecurringForDay(merged as any[], selectedDate);

      // Fetch participants per ORIGINAL meeting id (use original_id for recurring instances)
      const meetingsWithParticipants = await Promise.all(
        expanded.map(async (meeting: any) => {
          const sourceId = meeting.original_id || meeting.id;
          const { data: participantsData } = await supabase
            .from('meeting_participants')
            .select('user_id')
            .eq('meeting_id', sourceId);

          if (participantsData && participantsData.length > 0) {
            const userIds = participantsData.map((p) => p.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('*')
              .in('user_id', userIds);

            return { ...meeting, participants: profiles as Profile[] };
          }
          return { ...meeting, participants: [] };
        })
      );

      setMeetings(meetingsWithParticipants as MeetingWithParticipants[]);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMeetingClick = (meeting: MeetingWithParticipants) => {
    const anyM = meeting as any;
    if (anyM.is_recurring_instance && anyM.original_id) {
      setSelectedMeeting({ ...meeting, id: anyM.original_id });
    } else {
      setSelectedMeeting(meeting);
    }
    setDetailDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    fetchMeetingsForDay();
    onSuccess();
  };

  const handleDetailClose = () => {
    setDetailDialogOpen(false);
    setSelectedMeeting(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>
                {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: ru })}
              </span>
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="gap-1 flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет встреч на этот день
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    onClick={() => handleMeetingClick(meeting)}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">
                          {meeting.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {meeting.start_time.slice(0, 5)}
                            {meeting.end_time && ` - ${meeting.end_time.slice(0, 5)}`}
                          </span>
                        </div>
                        {meeting.participants && meeting.participants.length > 0 && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="flex flex-wrap gap-1">
                              {meeting.participants.slice(0, 3).map((p) => (
                                <Badge key={p.user_id} variant="secondary" className="text-xs">
                                  {p.name?.split(' ')[0] || p.email.split('@')[0]}
                                </Badge>
                              ))}
                              {meeting.participants.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{meeting.participants.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <MeetingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        selectedDate={selectedDate}
        defaultStartTime="09:00"
        onSuccess={handleCreateSuccess}
      />

      <MeetingDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleDetailClose}
        meeting={selectedMeeting}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
};
