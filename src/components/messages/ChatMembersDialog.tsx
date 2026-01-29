import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Trash2, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  avatar_color?: string | null;
}

interface ChatMember {
  user_id: string;
  role: string;
  profile: Profile;
}

interface ChatMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatCreatorId: string;
  onMembersUpdated: () => void;
}

export const ChatMembersDialog = ({
  open,
  onOpenChange,
  chatId,
  chatCreatorId,
  onMembersUpdated,
}: ChatMembersDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  const isCreator = user?.id === chatCreatorId;

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchAllProfiles();
      setSelectedToAdd([]);
      setShowAddSection(false);
    }
  }, [open, chatId]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('chat_members')
      .select('user_id, role')
      .eq('chat_id', chatId);

    if (error) {
      console.error('Error fetching members:', error);
      return;
    }

    // Fetch profiles for members
    const userIds = data.map(m => m.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, user_id, name, email, avatar_url, avatar_color')
      .in('user_id', userIds);

    if (profilesData) {
      const membersList: ChatMember[] = data.map(m => ({
        user_id: m.user_id,
        role: m.role,
        profile: profilesData.find(p => p.user_id === m.user_id) as Profile,
      })).filter(m => m.profile);
      
      setMembers(membersList);
    }
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, name, email, avatar_url, avatar_color');

    if (data) {
      setAllProfiles(data as Profile[]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;

    setLoading(true);
    try {
      const memberInserts = selectedToAdd.map(userId => ({
        chat_id: chatId,
        user_id: userId,
        role: 'member',
      }));

      const { error } = await supabase.from('chat_members').insert(memberInserts);

      if (error) throw error;

      toast.success(t('membersAdded') || 'Участники добавлены');
      setSelectedToAdd([]);
      setShowAddSection(false);
      fetchMembers();
      onMembersUpdated();
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error(t('errorAddingMembers') || 'Ошибка при добавлении участников');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (userId === chatCreatorId) {
      toast.error(t('cannotRemoveCreator') || 'Нельзя удалить создателя чата');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(t('memberRemoved') || 'Участник удалён');
      fetchMembers();
      onMembersUpdated();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error(t('errorRemovingMember') || 'Ошибка при удалении участника');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectMember = (userId: string) => {
    setSelectedToAdd(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const memberUserIds = members.map(m => m.user_id);
  const nonMembers = allProfiles.filter(p => !memberUserIds.includes(p.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('chatParticipants') || 'Участники чата'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current members */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              {t('currentMembers') || 'Текущие участники'} ({members.length})
            </h4>
            <ScrollArea className="h-48 border rounded-md">
              {members.map(member => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-3 border-b border-border/50 last:border-b-0"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.profile.avatar_url || undefined} />
                    <AvatarFallback
                      style={{ backgroundColor: member.profile.avatar_color || '#6366f1' }}
                      className="text-white text-xs"
                    >
                      {getInitials(member.profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{member.profile.name}</p>
                      {member.user_id === chatCreatorId && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          {t('creator') || 'Создатель'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.profile.email}
                    </p>
                  </div>
                  {isCreator && member.user_id !== chatCreatorId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Add members section */}
          {isCreator && (
            <>
              {showAddSection ? (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t('addParticipants') || 'Добавить участников'}
                  </h4>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    {nonMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('noUsersToAdd') || 'Все пользователи уже добавлены'}
                      </p>
                    ) : (
                      nonMembers.map(profile => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleSelectMember(profile.user_id)}
                        >
                          <Checkbox
                            checked={selectedToAdd.includes(profile.user_id)}
                            onCheckedChange={() => toggleSelectMember(profile.user_id)}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback
                              style={{ backgroundColor: profile.avatar_color || '#6366f1' }}
                              className="text-white text-xs"
                            >
                              {getInitials(profile.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{profile.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {profile.email}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                  {selectedToAdd.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('selected') || 'Выбрано'}: {selectedToAdd.length}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={handleAddMembers}
                      disabled={loading || selectedToAdd.length === 0}
                      className="flex-1"
                    >
                      {loading ? (t('adding') || 'Добавление...') : (t('addSelected') || 'Добавить выбранных')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddSection(false);
                        setSelectedToAdd([]);
                      }}
                    >
                      {t('cancel') || 'Отмена'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddSection(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('addParticipants') || 'Добавить участников'}
                </Button>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close') || 'Закрыть'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
