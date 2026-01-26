import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, BadgeCheck } from 'lucide-react';
import { Profile, UserPosition, POSITION_LABELS, AppRole } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile;
  onUpdate: () => void;
}

export const UserDialog = ({ open, onOpenChange, user, onUpdate }: UserDialogProps) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [position, setPosition] = useState<UserPosition | ''>(user.position || '');
  const [additionalInfo, setAdditionalInfo] = useState(user.additional_info || '');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState<AppRole>('user');
  const [roleLoading, setRoleLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(user.is_verified ?? false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { isAdmin } = useUserRole();

  const isOwnProfile = currentUser?.id === user.user_id;

  useEffect(() => {
    if (open) {
      fetchUserRole();
      setIsVerified(user.is_verified ?? false);
    }
  }, [open, user.user_id, user.is_verified]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.user_id)
      .maybeSingle();
    
    setUserRole((data?.role as AppRole) || 'user');
  };

  const handleVerificationToggle = async (verified: boolean) => {
    if (!isAdmin || isOwnProfile) return;
    
    setVerificationLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: verified })
        .eq('id', user.id);
      
      if (error) throw error;

      setIsVerified(verified);
      toast({ title: verified ? 'Пользователь верифицирован' : 'Верификация отозвана' });
      onUpdate();
    } catch (error) {
      console.error('Error updating verification:', error);
      toast({ title: 'Ошибка изменения верификации', variant: 'destructive' });
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRoleToggle = async (makeAdmin: boolean) => {
    if (!isAdmin || isOwnProfile) return;
    
    setRoleLoading(true);
    try {
      const newRole: AppRole = makeAdmin ? 'admin' : 'user';
      
      // Check if role record exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.user_id)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', user.user_id);
        
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.user_id, role: newRole });
        
        if (error) throw error;
      }

      setUserRole(newRole);
      toast({ title: makeAdmin ? 'Права админа выданы' : 'Права админа отозваны' });
      onUpdate();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({ title: 'Ошибка изменения прав', variant: 'destructive' });
    } finally {
      setRoleLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          phone: phone || null,
          position: position || null,
          additional_info: additionalInfo || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Профиль обновлён' });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Ошибка при обновлении', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Профиль пользователя</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-lg">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">ФИО *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+38 (0XX) XXX-XX-XX"
                />
              </div>

              <div className="space-y-2">
                <Label>Должность</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as UserPosition)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите должность" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POSITION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalInfo">Дополнительная информация</Label>
                <Textarea
                  id="additionalInfo"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  rows={3}
                  placeholder="Любая дополнительная информация..."
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={loading || !name.trim()} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {userRole === 'admin' && (
                  <Badge className="bg-primary/10 text-primary gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Администратор
                  </Badge>
                )}
                {isVerified ? (
                  <Badge className="bg-crm-success/10 text-crm-success gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    Верифицирован
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <BadgeCheck className="h-3 w-3" />
                    Не верифицирован
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Почта</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Телефон</p>
                  <p className="font-medium">{user.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ФИО</p>
                  <p className="font-medium">{user.name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Должность</p>
                  <p className="font-medium">
                    {user.position ? POSITION_LABELS[user.position as UserPosition] : '—'}
                  </p>
                </div>
              </div>

              {user.additional_info && (
                <div>
                  <p className="text-sm text-muted-foreground">Дополнительно</p>
                  <p className="font-medium">{user.additional_info}</p>
                </div>
              )}

              {/* Admin controls - only for admins viewing other users */}
              {isAdmin && !isOwnProfile && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Верификация</span>
                    </div>
                    <Switch
                      checked={isVerified}
                      onCheckedChange={handleVerificationToggle}
                      disabled={verificationLoading}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Права администратора</span>
                    </div>
                    <Switch
                      checked={userRole === 'admin'}
                      onCheckedChange={handleRoleToggle}
                      disabled={roleLoading}
                    />
                  </div>
                </div>
              )}

              {isOwnProfile && (
                <Button onClick={() => setIsEditing(true)} className="w-full">
                  Редактировать
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};