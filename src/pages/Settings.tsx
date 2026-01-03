import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, User, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserPosition } from '@/types/database';
import { useLanguage, Language } from '@/contexts/LanguageContext';

const Settings = () => {
  const { profile, refetchProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [position, setPosition] = useState<UserPosition | ''>(profile?.position || '');
  const [additionalInfo, setAdditionalInfo] = useState(profile?.additional_info || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const positionLabels: Record<UserPosition, string> = {
    director: t('director'),
    manager: t('manager'),
    developer: t('developer'),
    designer: t('designer'),
    analyst: t('analyst'),
    accountant: t('accountant'),
    hr: t('hr'),
    other: t('other'),
  };

  const handleSave = async () => {
    if (!profile || !name.trim()) return;

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
        .eq('id', profile.id);

      if (error) throw error;

      toast({ title: t('settingsSaved') });
      refetchProfile();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settingsTitle')}</h1>
        <p className="text-muted-foreground">{t('settingsDescription')}</p>
      </div>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={language === 'ru' ? 'default' : 'outline'}
              onClick={() => setLanguage('ru')}
              className="flex-1"
            >
              🇷🇺 {t('russian')}
            </Button>
            <Button
              variant={language === 'en' ? 'default' : 'outline'}
              onClick={() => setLanguage('en')}
              className="flex-1"
            >
              🇬🇧 {t('english')}
            </Button>
            <Button
              variant={language === 'uk' ? 'default' : 'outline'}
              onClick={() => setLanguage('uk')}
              className="flex-1"
            >
              🇺🇦 {t('ukrainian')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profile')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-lg">{profile?.name || t('user')}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fullName')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('enterName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t('position')}</Label>
              <Select value={position} onValueChange={(v) => setPosition(v as UserPosition)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPosition')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(positionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="additionalInfo">{t('additionalInfo')}</Label>
              <Textarea
                id="additionalInfo"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={4}
                placeholder={t('additionalInfoPlaceholder')}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
