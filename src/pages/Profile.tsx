import { useState, useRef, useEffect } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Camera, Palette } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserPosition } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAvatarColor } from '@/components/messages/EmployeesList';
import { cn } from '@/lib/utils';

const AVATAR_COLOR_OPTIONS = [
  { name: 'Blue', value: 'hsl(210, 70%, 50%)' },
  { name: 'Green', value: 'hsl(150, 60%, 45%)' },
  { name: 'Purple', value: 'hsl(280, 65%, 55%)' },
  { name: 'Pink', value: 'hsl(340, 70%, 50%)' },
  { name: 'Orange', value: 'hsl(25, 80%, 55%)' },
  { name: 'Teal', value: 'hsl(180, 60%, 45%)' },
  { name: 'Yellow', value: 'hsl(60, 70%, 45%)' },
  { name: 'Red', value: 'hsl(0, 70%, 55%)' },
  { name: 'Indigo', value: 'hsl(240, 60%, 55%)' },
  { name: 'Emerald', value: 'hsl(160, 60%, 40%)' },
];

const Profile = () => {
  const { profile, user, refetchProfile } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState<UserPosition | ''>('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync state with profile when loaded
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setPosition(profile.position || '');
      setAdditionalInfo(profile.additional_info || '');
      setAvatarUrl(profile.avatar_url || null);
      // @ts-ignore - avatar_color might not be in types yet
      setAvatarColor(profile.avatar_color || null);
    }
  }, [profile]);

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = publicUrl + '?t=' + Date.now();
      setAvatarUrl(newAvatarUrl);

      // Save avatar URL to profile
      await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('user_id', user.id);

      toast({ title: t('avatarUploaded') });
      refetchProfile();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ title: t('errorUploadingAvatar'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleColorChange = async (color: string) => {
    if (!user) return;
    setAvatarColor(color);
    
    await supabase
      .from('profiles')
      .update({ avatar_color: color })
      .eq('user_id', user.id);
    
    refetchProfile();
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
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({ title: t('profileSaved') });
      refetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
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

  const currentAvatarColor = user ? getAvatarColor(user.id, avatarColor) : 'hsl(210, 70%, 50%)';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('profileTitle')}</h1>
        <p className="text-muted-foreground">{t('profileDescription')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('personalInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={handleAvatarClick}>
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback 
                  className="text-white text-2xl font-medium"
                  style={{ backgroundColor: currentAvatarColor }}
                >
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : initials}
                </AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleAvatarClick}
              >
                <Camera className="h-6 w-6 text-white" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div>
              <h3 className="font-medium text-lg">{profile?.name || t('user')}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {profile?.position && (
                <p className="text-sm text-muted-foreground">{positionLabels[profile.position]}</p>
              )}
            </div>
          </div>

          {/* Avatar color picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t('avatarColor')}
            </Label>
            <p className="text-xs text-muted-foreground mb-2">{t('avatarColorDescription')}</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLOR_OPTIONS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    currentAvatarColor === colorOption.value 
                      ? "border-foreground ring-2 ring-foreground/20 scale-110" 
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: colorOption.value }}
                  onClick={() => handleColorChange(colorOption.value)}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fio')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('enterFio')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('enterEmail')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d+]/g, '');
                  // Auto-add +38 prefix
                  if (val && !val.startsWith('+')) {
                    val = '+38' + val;
                  }
                  if (val.startsWith('+') && !val.startsWith('+38')) {
                    val = '+38' + val.slice(1);
                  }
                  // Format: +38 (0XX) XXX-XX-XX
                  if (val.length > 3) {
                    const digits = val.slice(3).replace(/\D/g, '');
                    let formatted = '+38';
                    if (digits.length > 0) {
                      formatted += ' (' + digits.slice(0, 3);
                      if (digits.length >= 3) formatted += ')';
                      if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
                      if (digits.length > 6) formatted += '-' + digits.slice(6, 8);
                      if (digits.length > 8) formatted += '-' + digits.slice(8, 10);
                    }
                    val = formatted;
                  }
                  setPhone(val);
                }}
                placeholder="+38 (0XX) XXX-XX-XX"
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

export default Profile;