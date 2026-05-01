import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Profile } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

interface AddAssigneeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  existingAssigneeIds: string[];
  onAssigneeAdded: () => void;
}

export const AddAssigneeDialog = ({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  existingAssigneeIds,
  onAssigneeAdded,
}: AddAssigneeDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'executor' | 'observer'>('executor');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      // Filter out already assigned users
      const available = data.filter((p) => !existingAssigneeIds.includes(p.user_id));
      setProfiles(available as Profile[]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAdd = async () => {
    if (!selectedUserId || !user) return;
    setLoading(true);

    try {
      // Add assignee
      const { error } = await supabase.from('task_assignees').insert({
        task_id: taskId,
        user_id: selectedUserId,
        role: role,
      });

      if (error) throw error;

      // Send notification to the assigned user
      await supabase.from('notifications').insert({
        user_id: selectedUserId,
        type: 'task_assigned',
        title: t('newTaskAssigned') || 'Вас добавили в задачу',
        message: `${t('youWereAddedToTask') || 'Вы добавлены в задачу'}: "${taskTitle}" (${role === 'executor' ? t('executor') : t('observer')})`,
        task_id: taskId,
      });

      toast({ title: t('assigneeAdded') || 'Участник добавлен' });
      onAssigneeAdded();
      onOpenChange(false);
      setSelectedUserId(null);
    } catch (error) {
      console.error('Error adding assignee:', error);
      toast({ title: t('error') || 'Ошибка', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addParticipant') || 'Добавить участника'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">{t('role') || 'Роль'}</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as 'executor' | 'observer')} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="executor" id="executor" />
                <Label htmlFor="executor">{t('executor')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="observer" id="observer" />
                <Label htmlFor="observer">{t('observer')}</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">{t('selectUser') || 'Выберите пользователя'}</Label>
            <ScrollArea className="h-64 border rounded-lg">
              {profiles.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {t('noAvailableUsers') || 'Нет доступных пользователей'}
                </div>
              ) : (
                <div className="divide-y">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedUserId === profile.user_id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedUserId(profile.user_id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback
                            className="text-xs text-white"
                            style={{ backgroundColor: profile.avatar_color || '#6366F1' }}
                          >
                            {getInitials(profile.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{profile.name}</p>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={!selectedUserId || loading}>
              {t('add')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
