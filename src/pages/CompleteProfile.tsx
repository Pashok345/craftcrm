import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, CheckCircle } from 'lucide-react';
import { UserPosition } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';

const POSITION_LABELS_UK: Record<UserPosition, string> = {
  director: 'Директор',
  manager: 'Менеджер',
  developer: 'Розробник',
  designer: 'Дизайнер',
  analyst: 'Аналітик',
  accountant: 'Бухгалтер',
  hr: 'HR',
  other: 'Інше',
};

const CompleteProfile = () => {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('+38 ');
  const [position, setPosition] = useState<UserPosition | ''>('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // No session - redirect to auth
        navigate('/auth');
        return;
      }

      // Check if user already completed profile (has last_sign_in_at or is verified)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, is_verified, phone, position')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile?.is_verified) {
        // Already verified - go to dashboard
        navigate('/');
        return;
      }

      // User needs to complete profile
      setUserName(profile?.name || session.user.user_metadata?.name || '');
      
      // Pre-fill phone if exists
      if (profile?.phone) {
        setPhone(profile.phone);
      }
      
      // Pre-fill position if exists
      if (profile?.position) {
        setPosition(profile.position as UserPosition);
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const formatPhone = (value: string) => {
    // Remove all non-digits except + at start
    let digits = value.replace(/[^\d+]/g, '');
    
    // Ensure starts with +38
    if (!digits.startsWith('+38')) {
      digits = '+38' + digits.replace('+', '');
    }
    
    // Format: +38 (0XX) XXX-XX-XX
    const numbers = digits.slice(3); // Remove +38
    let formatted = '+38';
    
    if (numbers.length > 0) {
      formatted += ' (' + numbers.slice(0, 3);
    }
    if (numbers.length >= 3) {
      formatted += ') ' + numbers.slice(3, 6);
    }
    if (numbers.length >= 6) {
      formatted += '-' + numbers.slice(6, 8);
    }
    if (numbers.length >= 8) {
      formatted += '-' + numbers.slice(8, 10);
    }
    
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!password || password.length < 6) {
      toast({
        title: t('error'),
        description: 'Пароль повинен містити мінімум 6 символів',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t('error'),
        description: 'Паролі не співпадають',
        variant: 'destructive',
      });
      return;
    }

    if (!position) {
      toast({
        title: t('error'),
        description: 'Оберіть вашу посаду',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password,
      });

      if (passwordError) throw passwordError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: phone && phone.length > 4 ? phone : null,
          position: position,
          is_verified: true, // Mark as verified since they completed the profile
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast({
        title: 'Профіль завершено!',
        description: 'Ласкаво просимо до CRM системи',
      });

      // Redirect to dashboard
      navigate('/');
    } catch (error: any) {
      console.error('Error completing profile:', error);
      toast({
        title: t('error'),
        description: error.message || 'Не вдалося завершити реєстрацію',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-scale-in max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">CRM Pro</span>
        </div>

        {/* Welcome */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Вітаємо{userName ? `, ${userName}` : ''}! 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Завершіть налаштування вашого профілю для початку роботи
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Пароль *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Мінімум 6 символів"
              required
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Підтвердіть пароль *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторіть пароль"
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+38 (0XX) XXX-XX-XX"
            />
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label>Посада *</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as UserPosition)}>
              <SelectTrigger>
                <SelectValue placeholder="Оберіть посаду" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(POSITION_LABELS_UK).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full mt-6" 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Завершити реєстрацію
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
