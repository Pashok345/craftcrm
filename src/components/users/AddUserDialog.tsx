import { useState, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { POSITION_LABELS, UserPosition } from '@/types/database';
import { Loader2 } from 'lucide-react';

// Phone mask utility for +38 format
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  // Ensure it starts with 38
  let formatted = digits;
  if (!formatted.startsWith('38')) {
    formatted = '38' + formatted.replace(/^38/, '');
  }
  
  // Limit to 12 digits (38 + 10 digits)
  formatted = formatted.slice(0, 12);
  
  // Format: +38 (0XX) XXX-XX-XX
  let result = '+38';
  if (formatted.length > 2) {
    result += ' (' + formatted.slice(2, 5);
  }
  if (formatted.length > 5) {
    result += ') ' + formatted.slice(5, 8);
  }
  if (formatted.length > 8) {
    result += '-' + formatted.slice(8, 10);
  }
  if (formatted.length > 10) {
    result += '-' + formatted.slice(10, 12);
  }
  
  return result;
};

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddUserDialog = ({ open, onOpenChange, onSuccess }: AddUserDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState<UserPosition>('other');
  const [phone, setPhone] = useState('+38');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !password) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все обязательные поля',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Ошибка',
        description: 'Пароль должен быть не менее 6 символов',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Ошибка',
        description: 'Пароли не совпадают',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call the secure server-side edge function to create user
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { 
          email: email.trim(), 
          name: name.trim(),
          password: password,
          position: position,
          phone: phone.trim() !== '+38' ? phone.trim() : null,
        }
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      // Send welcome email with the reset link
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: { 
            email: email.trim(), 
            name: name.trim(),
            resetLink: data?.resetLink || null
          }
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      }

      toast({
        title: 'Пользователь создан',
        description: `Аккаунт для ${email} успешно создан. Ссылка для установки пароля отправлена на email.`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      let errorMessage = error.message || 'Не удалось создать пользователя';
      if (errorMessage.includes('already') || errorMessage.includes('exists')) {
        errorMessage = 'Пользователь с таким email уже существует';
      }
      
      toast({
        title: 'Ошибка',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPosition('other');
    setPhone('+38');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить пользователя</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Имя *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Повторите пароль *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Должность</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as UserPosition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(POSITION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+38 (0XX) XXX-XX-XX"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
