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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  type: 'group' | 'direct' | 'task';
  task_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreateChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: (chat: ChatGroup) => void;
}

export const CreateChatDialog = ({
  open,
  onOpenChange,
  onChatCreated,
}: CreateChatDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      setName('');
      setDescription('');
      setSelectedMembers([]);
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, name, email, avatar_url')
      .neq('user_id', user?.id);

    if (data) {
      setProfiles(data);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) {
      toast.error('Введите название группы');
      return;
    }

    setLoading(true);

    try {
      // Create chat group
      const { data: chatData, error: chatError } = await supabase
        .from('chat_groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type: 'group',
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add creator as admin
      await supabase.from('chat_members').insert({
        chat_id: chatData.id,
        user_id: user.id,
        role: 'admin',
      });

      // Add selected members
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map((userId) => ({
          chat_id: chatData.id,
          user_id: userId,
          role: 'member',
        }));

        await supabase.from('chat_members').insert(memberInserts);
      }

      toast.success('Чат создан');
      onChatCreated(chatData as ChatGroup);
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Ошибка при создании чата');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Создать группу
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Название группы</Label>
            <Input
              placeholder="Введите название..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Описание (необязательно)</Label>
            <Textarea
              placeholder="Описание группы..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Участники</Label>
            <ScrollArea className="h-48 border rounded-md p-2">
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Нет доступных пользователей
                </p>
              ) : (
                profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleMember(profile.user_id)}
                  >
                    <Checkbox
                      checked={selectedMembers.includes(profile.user_id)}
                      onCheckedChange={() => toggleMember(profile.user_id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
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
            {selectedMembers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Выбрано: {selectedMembers.length}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};