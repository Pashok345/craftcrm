import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Paperclip, X, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export const TASK_COLORS = [
  { value: '#3b82f6', label: 'Синий' },
  { value: '#22c55e', label: 'Зелёный' },
  { value: '#eab308', label: 'Жёлтый' },
  { value: '#f97316', label: 'Оранжевый' },
  { value: '#ef4444', label: 'Красный' },
  { value: '#a855f7', label: 'Фиолетовый' },
  { value: '#ec4899', label: 'Розовый' },
  { value: '#06b6d4', label: 'Голубой' },
];

export const BG_COLORS = [
  { value: '', label: 'Нет' },
  { value: '#fef3c7', label: 'Кремовый' },
  { value: '#dbeafe', label: 'Голубой' },
  { value: '#dcfce7', label: 'Мятный' },
  { value: '#fce7f3', label: 'Розовый' },
  { value: '#ede9fe', label: 'Лавандовый' },
  { value: '#fee2e2', label: 'Персиковый' },
  { value: '#f1f5f9', label: 'Серый' },
  { value: '#1e293b', label: 'Тёмный' },
  { value: '#0f172a', label: 'Ночь' },
];

export const GRADIENTS = [
  { value: '', label: 'Нет' },
  { value: 'linear-gradient(135deg,#667eea,#764ba2)', label: 'Фиолет' },
  { value: 'linear-gradient(135deg,#f093fb,#f5576c)', label: 'Закат' },
  { value: 'linear-gradient(135deg,#4facfe,#00f2fe)', label: 'Океан' },
  { value: 'linear-gradient(135deg,#43e97b,#38f9d7)', label: 'Свежесть' },
  { value: 'linear-gradient(135deg,#fa709a,#fee140)', label: 'Заря' },
  { value: 'linear-gradient(135deg,#30cfd0,#330867)', label: 'Глубина' },
  { value: 'linear-gradient(135deg,#ff9a9e,#fecfef)', label: 'Сакура' },
  { value: 'linear-gradient(135deg,#a8edea,#fed6e3)', label: 'Пастель' },
  { value: 'linear-gradient(135deg,#ff6e7f,#bfe9ff)', label: 'Кораллы' },
  { value: 'linear-gradient(135deg,#000428,#004e92)', label: 'Полночь' },
];

export const FONT_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: '"Merriweather", serif', label: 'Merriweather' },
  { value: '"Abril Fatface", serif', label: 'Abril Fatface' },
  { value: '"Roboto Mono", monospace', label: 'Roboto Mono' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' },
  { value: '"Press Start 2P", monospace', label: 'Press Start 2P' },
  { value: '"Comfortaa", cursive', label: 'Comfortaa' },
  { value: '"Bebas Neue", sans-serif', label: 'Bebas Neue' },
  { value: '"Anton", sans-serif', label: 'Anton' },
  { value: '"Oswald", sans-serif', label: 'Oswald' },
  { value: '"Russo One", sans-serif', label: 'Russo One' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat 900' },
  { value: '"Raleway", sans-serif', label: 'Raleway' },
  { value: '"Exo 2", sans-serif', label: 'Exo 2' },
  { value: '"Righteous", sans-serif', label: 'Righteous' },
  { value: '"Caveat", cursive', label: 'Caveat' },
  { value: '"Dancing Script", cursive', label: 'Dancing Script' },
  { value: '"Pacifico", cursive', label: 'Pacifico' },
  { value: '"Lobster", cursive', label: 'Lobster' },
  { value: '"Great Vibes", cursive', label: 'Great Vibes' },
  { value: '"Shadows Into Light", cursive', label: 'Shadows Into Light' },
  { value: '"Permanent Marker", cursive', label: 'Permanent Marker' },
  { value: '"Indie Flower", cursive', label: 'Indie Flower' },
];

export const ICON_OPTIONS = ['', '🚀', '⭐', '🔥', '💡', '✅', '🎯', '📌', '🐛', '⚡', '💎', '🏆', '📈', '🎨', '🛠️', '📝', '⏰', '🔔', '🎉', '💼', '📊', '🌟'];

export interface TaskCustomizationValue {
  color: string;
  bgColor: string;
  bgImageUrl: string;
  accentColor: string;
  icon: string;
  titleFont: string;
  gradient: string;
}

export const emptyCustomization: TaskCustomizationValue = {
  color: '#3b82f6', bgColor: '', bgImageUrl: '', accentColor: '', icon: '', titleFont: '', gradient: '',
};

interface TaskCustomizationProps {
  value: TaskCustomizationValue;
  onChange: (v: TaskCustomizationValue) => void;
  previewTitle?: string;
  uploadFolder?: string; // path prefix for bg upload
}

export const TaskCustomization = ({ value, onChange, previewTitle, uploadFolder }: TaskCustomizationProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingBg, setUploadingBg] = useState(false);
  const set = (patch: Partial<TaskCustomizationValue>) => onChange({ ...value, ...patch });

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingBg(true);
    try {
      const sanitized = file.name.replace(/[^\w.-]/g, '_');
      const folder = uploadFolder || user.id;
      const path = `${folder}/bg-${Date.now()}-${sanitized}`;
      const { error: upErr } = await supabase.storage.from('task-attachments').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from('task-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) set({ bgImageUrl: signed.signedUrl });
    } catch (err) {
      console.error(err);
      toast({ title: 'Ошибка загрузки фото', variant: 'destructive' });
    } finally {
      setUploadingBg(false);
      if (e.target) e.target.value = '';
    }
  };

  // Build preview style
  const previewStyle: React.CSSProperties = {};
  if (value.gradient) { previewStyle.backgroundImage = value.gradient; previewStyle.color = '#fff'; }
  else if (value.bgImageUrl) {
    previewStyle.backgroundImage = `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url(${value.bgImageUrl})`;
    previewStyle.backgroundSize = 'cover'; previewStyle.backgroundPosition = 'center';
  } else if (value.bgColor) { previewStyle.backgroundColor = value.bgColor; }
  if (value.accentColor) previewStyle.borderLeft = `4px solid ${value.accentColor}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Цвет фона карточки</Label>
          <div className="flex gap-2 flex-wrap">
            {BG_COLORS.map((c) => (
              <button key={c.value || 'none'} type="button"
                className={cn('w-9 h-9 rounded-md border-2 transition-all flex items-center justify-center text-xs',
                  value.bgColor === c.value ? 'border-foreground scale-110' : 'border-border')}
                style={{ backgroundColor: c.value || 'transparent' }}
                onClick={() => set({ bgColor: c.value })} title={c.label}>
                {!c.value && '✕'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Градиент</Label>
          <div className="flex gap-2 flex-wrap">
            {GRADIENTS.map((g) => (
              <button key={g.value || 'none'} type="button"
                className={cn('h-9 px-3 rounded-md border-2 transition-all text-xs font-medium',
                  value.gradient === g.value ? 'border-foreground scale-105' : 'border-border')}
                style={{ background: g.value || 'hsl(var(--muted))', color: g.value ? '#fff' : 'hsl(var(--muted-foreground))' }}
                onClick={() => set({ gradient: g.value })}>{g.label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Фоновое изображение</Label>
          {value.bgImageUrl && (
            <div className="relative w-full h-24 rounded-md overflow-hidden border border-border">
              <img src={value.bgImageUrl} alt="bg" className="w-full h-full object-cover" />
              <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6"
                onClick={() => set({ bgImageUrl: '' })}><X className="h-3 w-3" /></Button>
            </div>
          )}
          <input type="file" id="task-bg-upload" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
          <Button type="button" variant="outline" size="sm" disabled={uploadingBg}
            onClick={() => document.getElementById('task-bg-upload')?.click()}>
            {uploadingBg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
            {value.bgImageUrl ? 'Заменить фото' : 'Загрузить фото'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Акцент (рамка)</Label>
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" onClick={() => set({ accentColor: '' })}
                className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs',
                  !value.accentColor ? 'border-foreground' : 'border-border')}>✕</button>
              {TASK_COLORS.map((c) => (
                <button key={c.value} type="button"
                  className={cn('w-7 h-7 rounded-full border-2 transition-all',
                    value.accentColor === c.value ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c.value }}
                  onClick={() => set({ accentColor: c.value })} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Иконка</Label>
            <div className="flex gap-1 flex-wrap">
              {ICON_OPTIONS.map((i) => (
                <button key={i || 'none'} type="button"
                  className={cn('w-7 h-7 rounded-md border-2 transition-all text-base flex items-center justify-center',
                    value.icon === i ? 'border-foreground bg-muted' : 'border-border')}
                  onClick={() => set({ icon: i })}>{i || '✕'}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Цвет на диаграмме</Label>
          <div className="flex flex-wrap gap-2">
            {TASK_COLORS.map((c) => (
              <button key={c.value} type="button"
                className={cn('w-8 h-8 rounded-full border-2 transition-all',
                  value.color === c.value ? 'border-foreground scale-110' : 'border-transparent')}
                style={{ backgroundColor: c.value }} onClick={() => set({ color: c.value })} title={c.label} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Шрифт заголовка</Label>
          <Select value={value.titleFont || '__default__'} onValueChange={(v) => set({ titleFont: v === '__default__' ? '' : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value || '__default__'} value={f.value || '__default__'}>
                  <span style={{ fontFamily: f.value || undefined }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-2 lg:sticky lg:top-4 self-start">
        <Label className="text-xs text-muted-foreground">Предпросмотр</Label>
        <Card className="overflow-hidden bg-background" style={previewStyle}>
          <CardContent className="p-3">
            <h4 className="font-medium mb-1 line-clamp-2 flex items-center gap-1.5"
              style={value.titleFont ? { fontFamily: value.titleFont } : undefined}>
              {value.icon && <span className="text-base">{value.icon}</span>}
              <span className="truncate">{previewTitle?.trim() || 'Название задачи'}</span>
            </h4>
            <p className="text-xs opacity-80 line-clamp-2 mb-2">Пример описания задачи для предпросмотра дизайна.</p>
            <div className="flex items-center gap-1 text-xs opacity-80">
              <Calendar className="h-3 w-3" />
              <span>сегодня</span>
            </div>
          </CardContent>
        </Card>
        <p className="text-[11px] text-muted-foreground">Так будет выглядеть карточка задачи.</p>
      </div>
    </div>
  );
};
