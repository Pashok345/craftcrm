import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Globe, Bell, Moon, Monitor } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';

const Settings = () => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [notifyMeetings, setNotifyMeetings] = useState(() => 
    localStorage.getItem('notify-meetings') !== 'false'
  );
  const [notifyTasks, setNotifyTasks] = useState(() => 
    localStorage.getItem('notify-tasks') !== 'false'
  );
  const [notifyMessages, setNotifyMessages] = useState(() => 
    localStorage.getItem('notify-messages') !== 'false'
  );
  const [soundEnabled, setSoundEnabled] = useState(() => 
    localStorage.getItem('sound-enabled') !== 'false'
  );

  useEffect(() => {
    localStorage.setItem('notify-meetings', String(notifyMeetings));
  }, [notifyMeetings]);
  useEffect(() => {
    localStorage.setItem('notify-tasks', String(notifyTasks));
  }, [notifyTasks]);
  useEffect(() => {
    localStorage.setItem('notify-messages', String(notifyMessages));
  }, [notifyMessages]);
  useEffect(() => {
    localStorage.setItem('sound-enabled', String(soundEnabled));
  }, [soundEnabled]);

  const languageLabels: Record<Language, string> = {
    ru: 'RUS',
    en: 'ENG',
    uk: 'UKR',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settingsTitle')}</h1>
        <p className="text-muted-foreground">{t('settingsDescription')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(languageLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            {t('themeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={theme || 'system'} onValueChange={setTheme}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('themeLight')}</SelectItem>
              <SelectItem value="dark">{t('themeDark')}</SelectItem>
              <SelectItem value="system">{t('themeSystem')}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notificationSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notify-meetings" className="flex-1 cursor-pointer">
              {t('notifyMeetings')}
            </Label>
            <Switch id="notify-meetings" checked={notifyMeetings} onCheckedChange={setNotifyMeetings} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notify-tasks" className="flex-1 cursor-pointer">
              {t('notifyTasks')}
            </Label>
            <Switch id="notify-tasks" checked={notifyTasks} onCheckedChange={setNotifyTasks} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notify-messages" className="flex-1 cursor-pointer">
              {t('notifyMessages')}
            </Label>
            <Switch id="notify-messages" checked={notifyMessages} onCheckedChange={setNotifyMessages} />
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <Label htmlFor="sound-enabled" className="flex-1 cursor-pointer">
              {t('soundNotifications')}
            </Label>
            <Switch id="sound-enabled" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
