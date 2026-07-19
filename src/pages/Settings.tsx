import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, Bell, Moon, Key, Building2, MapPin, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

type CategoryValue = Record<string, any>;

const useSettingsCategory = (category: string, defaults: CategoryValue) => {
  const [value, setValue] = useState<CategoryValue>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', category)
        .maybeSingle();
      if (alive) {
        setValue({ ...defaults, ...((data?.value as CategoryValue) || {}) });
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ category, value, updated_by: (await supabase.auth.getUser()).data.user?.id });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Saved');
  };

  return { value, setValue, loading, saving, save };
};

const SecretInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full"
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
};

const Settings = () => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();

  const [notifyMeetings, setNotifyMeetings] = useState(() => localStorage.getItem('notify-meetings') !== 'false');
  const [notifyTasks, setNotifyTasks] = useState(() => localStorage.getItem('notify-tasks') !== 'false');
  const [notifyMessages, setNotifyMessages] = useState(() => localStorage.getItem('notify-messages') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('sound-enabled') !== 'false');

  useEffect(() => { localStorage.setItem('notify-meetings', String(notifyMeetings)); }, [notifyMeetings]);
  useEffect(() => { localStorage.setItem('notify-tasks', String(notifyTasks)); }, [notifyTasks]);
  useEffect(() => { localStorage.setItem('notify-messages', String(notifyMessages)); }, [notifyMessages]);
  useEffect(() => { localStorage.setItem('sound-enabled', String(soundEnabled)); }, [soundEnabled]);

  const integrations = useSettingsCategory('integrations', {
    aiApiKey: '', aiModel: 'google/gemini-2.5-flash', emailApiKey: '', emailFromAddress: '',
    telegramBotToken: '', webhookUrl: '', analyticsKey: '',
  });
  const company = useSettingsCategory('company', {
    name: '', email: '', phone: '', address: '', website: '', taxId: '',
  });
  const regional = useSettingsCategory('regional', {
    currency: 'UAH', timezone: 'Europe/Kiev', weekStart: 'monday', dateFormat: 'DD.MM.YYYY',
  });
  const security = useSettingsCategory('security', {
    sessionTimeout: 60, requireStrongPasswords: true, allowSelfRegistration: false,
  });

  if (!user || roleLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const languageLabels: Record<Language, string> = { ru: 'RUS', en: 'ENG', uk: 'UKR' };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settingsTitle')}</h1>
        <p className="text-muted-foreground">{t('settingsDescription')}</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
          <TabsTrigger value="general"><Globe className="h-4 w-4 mr-2" />{t('settingsTabGeneral')}</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-2" />{t('settingsTabNotifications')}</TabsTrigger>
          <TabsTrigger value="integrations"><Key className="h-4 w-4 mr-2" />{t('settingsTabIntegrations')}</TabsTrigger>
          <TabsTrigger value="company"><Building2 className="h-4 w-4 mr-2" />{t('settingsTabCompany')}</TabsTrigger>
          <TabsTrigger value="regional"><MapPin className="h-4 w-4 mr-2" />{t('settingsTabRegional')}</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck className="h-4 w-4 mr-2" />{t('settingsTabSecurity')}</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />{t('language')}</CardTitle></CardHeader>
            <CardContent>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(languageLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Moon className="h-5 w-5" />{t('themeTitle')}</CardTitle></CardHeader>
            <CardContent>
              <Select value={theme || 'system'} onValueChange={setTheme}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('themeLight')}</SelectItem>
                  <SelectItem value="dark">{t('themeDark')}</SelectItem>
                  <SelectItem value="system">{t('themeSystem')}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />{t('notificationSettings')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><Label htmlFor="nm" className="flex-1 cursor-pointer">{t('notifyMeetings')}</Label><Switch id="nm" checked={notifyMeetings} onCheckedChange={setNotifyMeetings} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="nt" className="flex-1 cursor-pointer">{t('notifyTasks')}</Label><Switch id="nt" checked={notifyTasks} onCheckedChange={setNotifyTasks} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="nmsg" className="flex-1 cursor-pointer">{t('notifyMessages')}</Label><Switch id="nmsg" checked={notifyMessages} onCheckedChange={setNotifyMessages} /></div>
              <div className="flex items-center justify-between border-t pt-4"><Label htmlFor="ns" className="flex-1 cursor-pointer">{t('soundNotifications')}</Label><Switch id="ns" checked={soundEnabled} onCheckedChange={setSoundEnabled} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTEGRATIONS */}
        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />{t('settingsTabIntegrations')}</CardTitle>
              <CardDescription>{t('integrationsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>{t('aiApiKey')}</Label><SecretInput value={integrations.value.aiApiKey || ''} onChange={(v) => integrations.setValue({ ...integrations.value, aiApiKey: v })} placeholder="sk-..." /></div>
              <div className="space-y-2"><Label>{t('aiModel')}</Label><Input value={integrations.value.aiModel || ''} onChange={(e) => integrations.setValue({ ...integrations.value, aiModel: e.target.value })} placeholder="google/gemini-2.5-flash" /></div>
              <div className="space-y-2"><Label>{t('emailApiKey')}</Label><SecretInput value={integrations.value.emailApiKey || ''} onChange={(v) => integrations.setValue({ ...integrations.value, emailApiKey: v })} placeholder="re_..." /></div>
              <div className="space-y-2"><Label>{t('emailFromAddress')}</Label><Input type="email" value={integrations.value.emailFromAddress || ''} onChange={(e) => integrations.setValue({ ...integrations.value, emailFromAddress: e.target.value })} placeholder="noreply@company.com" /></div>
              <div className="space-y-2"><Label>{t('telegramBotToken')}</Label><SecretInput value={integrations.value.telegramBotToken || ''} onChange={(v) => integrations.setValue({ ...integrations.value, telegramBotToken: v })} /></div>
              <div className="space-y-2"><Label>{t('webhookUrl')}</Label><Input value={integrations.value.webhookUrl || ''} onChange={(e) => integrations.setValue({ ...integrations.value, webhookUrl: e.target.value })} placeholder="https://..." /></div>
              <div className="space-y-2"><Label>{t('analyticsKey')}</Label><Input value={integrations.value.analyticsKey || ''} onChange={(e) => integrations.setValue({ ...integrations.value, analyticsKey: e.target.value })} placeholder="G-XXXXXX / domain.com" /></div>
              <Button onClick={integrations.save} disabled={integrations.saving}>{integrations.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPANY */}
        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t('settingsTabCompany')}</CardTitle>
              <CardDescription>{t('companyDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('companyName')}</Label><Input value={company.value.name || ''} onChange={(e) => company.setValue({ ...company.value, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('companyTaxId')}</Label><Input value={company.value.taxId || ''} onChange={(e) => company.setValue({ ...company.value, taxId: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('companyEmail')}</Label><Input type="email" value={company.value.email || ''} onChange={(e) => company.setValue({ ...company.value, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('companyPhone')}</Label><Input value={company.value.phone || ''} onChange={(e) => company.setValue({ ...company.value, phone: e.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><Label>{t('companyWebsite')}</Label><Input value={company.value.website || ''} onChange={(e) => company.setValue({ ...company.value, website: e.target.value })} placeholder="https://" /></div>
                <div className="space-y-2 md:col-span-2"><Label>{t('companyAddress')}</Label><Textarea value={company.value.address || ''} onChange={(e) => company.setValue({ ...company.value, address: e.target.value })} /></div>
              </div>
              <Button onClick={company.save} disabled={company.saving}>{company.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REGIONAL */}
        <TabsContent value="regional" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />{t('settingsTabRegional')}</CardTitle>
              <CardDescription>{t('regionalDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('defaultCurrency')}</Label>
                  <Select value={regional.value.currency} onValueChange={(v) => regional.setValue({ ...regional.value, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UAH">UAH ₴</SelectItem>
                      <SelectItem value="USD">USD $</SelectItem>
                      <SelectItem value="EUR">EUR €</SelectItem>
                      <SelectItem value="PLN">PLN zł</SelectItem>
                      <SelectItem value="GBP">GBP £</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('timezone')}</Label>
                  <Select value={regional.value.timezone} onValueChange={(v) => regional.setValue({ ...regional.value, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Kiev">Europe/Kyiv (UTC+2)</SelectItem>
                      <SelectItem value="Europe/Warsaw">Europe/Warsaw (UTC+1)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (UTC)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('weekStart')}</Label>
                  <Select value={regional.value.weekStart} onValueChange={(v) => regional.setValue({ ...regional.value, weekStart: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">{t('weekMonday')}</SelectItem>
                      <SelectItem value="sunday">{t('weekSunday')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('dateFormat')}</Label>
                  <Select value={regional.value.dateFormat} onValueChange={(v) => regional.setValue({ ...regional.value, dateFormat: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD.MM.YYYY">DD.MM.YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={regional.save} disabled={regional.saving}>{regional.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{t('settingsTabSecurity')}</CardTitle>
              <CardDescription>{t('securityDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-xs">
                <Label>{t('sessionTimeout')}</Label>
                <Input type="number" min={5} max={1440} value={security.value.sessionTimeout} onChange={(e) => security.setValue({ ...security.value, sessionTimeout: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <Label className="flex-1 cursor-pointer">{t('requireStrongPasswords')}</Label>
                <Switch checked={!!security.value.requireStrongPasswords} onCheckedChange={(v) => security.setValue({ ...security.value, requireStrongPasswords: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex-1 cursor-pointer">{t('allowSelfRegistration')}</Label>
                <Switch checked={!!security.value.allowSelfRegistration} onCheckedChange={(v) => security.setValue({ ...security.value, allowSelfRegistration: v })} />
              </div>
              <Button onClick={security.save} disabled={security.saving}>{security.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <AlertDescription>{t('adminOnly')}</AlertDescription>
      </Alert>
    </div>
  );
};

export default Settings;
