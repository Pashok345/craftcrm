import { useState } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Profile, UserPosition, POSITION_LABELS } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

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
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const isOwnProfile = currentUser?.id === user.user_id;

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
                  placeholder="+7 (999) 123-45-67"
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
