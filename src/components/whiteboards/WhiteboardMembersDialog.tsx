import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface Member {
  id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  profile?: { name: string; avatar_url: string | null; avatar_color: string | null };
}

interface Profile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whiteboardId: string;
  ownerId: string;
  currentUserId: string;
}

export const WhiteboardMembersDialog = ({ open, onOpenChange, whiteboardId, ownerId, currentUserId }: Props) => {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('editor');
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);

  const isOwner = currentUserId === ownerId;

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchUsers();
    }
  }, [open, whiteboardId]);

  const fetchMembers = async () => {
    const { data: mems } = await supabase
      .from('whiteboard_members')
      .select('*')
      .eq('whiteboard_id', whiteboardId);

    const userIds = (mems || []).map((m: any) => m.user_id);
    userIds.push(ownerId);

    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, name, avatar_url, avatar_color')
      .in('user_id', userIds);

    const profMap: Record<string, Profile> = {};
    (profs || []).forEach((p: any) => (profMap[p.user_id] = p));

    setOwnerProfile(profMap[ownerId] || null);
    setMembers(
      ((mems as any[]) || []).map((m) => ({
        ...m,
        profile: profMap[m.user_id],
      })),
    );
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, name, avatar_url, avatar_color')
      .order('name');
    setAllUsers((data as Profile[]) || []);
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    const { error } = await supabase.from('whiteboard_members').insert({
      whiteboard_id: whiteboardId,
      user_id: selectedUser,
      role: selectedRole,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelectedUser('');
    fetchMembers();
  };

  const handleRoleChange = async (memberId: string, role: 'editor' | 'viewer') => {
    const { error } = await supabase.from('whiteboard_members').update({ role }).eq('id', memberId);
    if (error) toast.error(error.message);
    else fetchMembers();
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase.from('whiteboard_members').delete().eq('id', memberId);
    if (error) toast.error(error.message);
    else fetchMembers();
  };

  const memberUserIds = new Set([ownerId, ...members.map((m) => m.user_id)]);
  const availableUsers = allUsers.filter(
    (u) =>
      !memberUserIds.has(u.user_id) &&
      u.user_id !== currentUserId &&
      (search ? u.name.toLowerCase().includes(search.toLowerCase()) : true),
  );

  const initials = (name?: string) =>
    (name || '?')
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-12">
          <DialogTitle>{t('whiteboardMembers')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ScrollArea className="max-h-[260px] pr-2">
            <div className="space-y-2">
              {/* Owner */}
              {ownerProfile && (
                <div className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                  <Avatar className="h-8 w-8">
                    {ownerProfile.avatar_url ? (
                      <AvatarImage src={ownerProfile.avatar_url} />
                    ) : (
                      <AvatarFallback style={{ backgroundColor: ownerProfile.avatar_color || undefined }}>
                        {initials(ownerProfile.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ownerProfile.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      {t('whiteboardOwner')}
                    </p>
                  </div>
                </div>
              )}
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
                  <Avatar className="h-8 w-8">
                    {m.profile?.avatar_url ? (
                      <AvatarImage src={m.profile.avatar_url} />
                    ) : (
                      <AvatarFallback style={{ backgroundColor: m.profile?.avatar_color || undefined }}>
                        {initials(m.profile?.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.profile?.name || '...'}</p>
                  </div>
                  {isOwner ? (
                    <>
                      <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as any)}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">{t('whiteboardRoleEditor')}</SelectItem>
                          <SelectItem value="viewer">{t('whiteboardRoleViewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {m.role === 'editor' ? t('whiteboardRoleEditor') : t('whiteboardRoleViewer')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {isOwner && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">{t('whiteboardAddMember')}</p>
              <Input
                placeholder={t('whiteboardSearchUser')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">—</div>
                    ) : (
                      availableUsers.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">{t('whiteboardRoleEditor')}</SelectItem>
                    <SelectItem value="viewer">{t('whiteboardRoleViewer')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" onClick={handleAdd} disabled={!selectedUser}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
