import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Calendar, Users, Trash2, User, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { Meeting, Profile } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { MeetingEditDialog } from './MeetingEditDialog';

interface MeetingWithParticipants extends Meeting {
  participants?: Profile[];
}

interface MeetingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingWithParticipants | null;
  onSuccess: () => void;
}

export const MeetingDetailDialog = ({
  open,
  onOpenChange,
  meeting,
  onSuccess,
}: MeetingDetailDialogProps) => {
  const [creator, setCreator] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (meeting?.created_by) {
      fetchCreator();
    }
  }, [meeting]);

  const fetchCreator = async () => {
    if (!meeting) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', meeting.created_by)
      .maybeSingle();
    if (data) setCreator(data as Profile);
  };

  const handleDelete = async () => {
    if (!meeting) return;
    setDeleting(true);
    try {
      await supabase
        .from('meeting_participants')
        .delete()
        .eq('meeting_id', meeting.id);

      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id);

      if (error) throw error;

      toast({ title: t('meetingDeleted') || 'Встреча удалена' });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast({ title: t('errorDeleting') || 'Ошибка при удалении', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditOpen(false);
    onOpenChange(false);
    onSuccess();
  };

  if (!meeting) return null;

  const isCreator = user?.id === meeting.created_by;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{meeting.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(meeting.meeting_date), 'd MMMM yyyy', { locale: dateLocale })}
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {meeting.start_time.slice(0, 5)}
                  {meeting.end_time && ` - ${meeting.end_time.slice(0, 5)}`}
                </span>
              </div>
            </div>

            {meeting.description && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-foreground">{t('description') || 'Описание'}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {meeting.description}
                </p>
              </div>
            )}

            <Separator />

            {creator && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('organizer') || 'Организатор'}
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{creator.name || creator.email}</Badge>
                </div>
              </div>
            )}

            {meeting.participants && meeting.participants.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('participants') || 'Участники'} ({meeting.participants.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {meeting.participants.map((p) => (
                    <Badge key={p.user_id} variant="secondary">
                      {p.name || p.email}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {isCreator && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('edit') || 'Редактировать'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1 gap-2">
                        <Trash2 className="h-4 w-4" />
                        {t('delete') || 'Удалить'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteMeetingConfirm') || 'Удалить встречу?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('deleteMeetingDescription') || 'Это действие нельзя отменить. Встреча будет удалена навсегда.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel') || 'Отмена'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                          {t('delete') || 'Удалить'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {meeting && (
        <MeetingEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          meeting={meeting}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
};
