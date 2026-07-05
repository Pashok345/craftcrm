import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image as ImageIcon, Palette, Smile, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Project, ProjectCoverLibraryItem } from '@/types/database';
import { cn } from '@/lib/utils';

interface Props {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const ACCENT_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#64748B', '#0F172A',
];

const ICON_CHOICES = ['📁','📊','🚀','⚙️','🎨','💡','🎯','🏆','📈','🔧','🌟','💼','📝','🧩','🔒','📦','🛠️','🧠','🌍','🎬','🍀','🔥'];

export function ProjectCustomizeDialog({ project, open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [cover, setCover] = useState<string | null>(project.cover_image_url ?? null);
  const [accent, setAccent] = useState<string | null>(project.accent_color ?? null);
  const [icon, setIcon] = useState<string | null>(project.icon ?? null);
  const [library, setLibrary] = useState<ProjectCoverLibraryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvedCover, setResolvedCover] = useState<string | null>(null);

  useEffect(() => {
    setCover(project.cover_image_url ?? null);
    setAccent(project.accent_color ?? null);
    setIcon(project.icon ?? null);
  }, [project]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('project_cover_library')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => setLibrary((data || []) as ProjectCoverLibraryItem[]));
  }, [open]);

  // Resolve cover URL for preview (handles sb:// signed URLs)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cover) { setResolvedCover(null); return; }
      if (cover.startsWith('sb://')) {
        const [, , bucket, ...rest] = cover.split('/');
        const path = rest.join('/');
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (!cancelled) setResolvedCover(data?.signedUrl || null);
      } else {
        setResolvedCover(cover);
      }
    })();
    return () => { cancelled = true; };
  }, [cover]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.-]/g, '_');
      const path = `_covers/${project.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from('project-attachments')
        .upload(path, file, { upsert: false });
      if (error) throw error;
      setCover(`sb://project-attachments/${path}`);
      toast({ title: 'Обложка загружена' });
    } catch (e: any) {
      toast({ title: 'Ошибка загрузки', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          cover_image_url: cover,
          accent_color: accent,
          icon: icon,
        })
        .eq('id', project.id);
      if (error) throw error;
      toast({ title: 'Оформление сохранено' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Не удалось сохранить', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-x-hidden pr-12">
        <DialogHeader>
          <DialogTitle>Оформление проекта</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-lg overflow-hidden border">
          <div
            className="h-32 bg-cover bg-center flex items-end p-3"
            style={{
              backgroundImage: resolvedCover ? `url(${resolvedCover})` : undefined,
              backgroundColor: !resolvedCover ? (accent || 'hsl(var(--muted))') : undefined,
            }}
          >
            <div className="flex items-center gap-2 bg-background/85 backdrop-blur rounded-md px-2 py-1">
              {icon && <span className="text-lg leading-none">{icon}</span>}
              <span className="text-sm font-medium">{project.title}</span>
              {accent && (
                <span className="ml-1 h-3 w-3 rounded-full border" style={{ backgroundColor: accent }} />
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="cover" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="cover"><ImageIcon className="h-4 w-4 mr-1" />Обложка</TabsTrigger>
            <TabsTrigger value="color"><Palette className="h-4 w-4 mr-1" />Цвет</TabsTrigger>
            <TabsTrigger value="icon"><Smile className="h-4 w-4 mr-1" />Иконка</TabsTrigger>
          </TabsList>

          <TabsContent value="cover" className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> {uploading ? 'Загрузка…' : 'Загрузить'}
              </Button>
              {cover && (
                <Button size="sm" variant="ghost" onClick={() => setCover(null)}>
                  <X className="h-4 w-4 mr-1" /> Убрать
                </Button>
              )}
            </div>
            <Label className="text-xs text-muted-foreground">Библиотека</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto">
              {library.map((item) => {
                const active = cover === item.url;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCover(item.url)}
                    className={cn(
                      'relative rounded-md overflow-hidden border-2 transition-all aspect-[2/1]',
                      active ? 'border-primary shadow-md' : 'border-transparent hover:border-muted-foreground/30'
                    )}
                    title={item.name || ''}
                  >
                    <img src={item.url} alt={item.name || ''} className="w-full h-full object-cover" loading="lazy" />
                    {active && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="color" className="space-y-3">
            <div className="grid grid-cols-8 gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 transition-all',
                    accent === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={accent || ''}
                placeholder="#3B82F6"
                onChange={(e) => setAccent(e.target.value || null)}
                className="w-32"
              />
              {accent && (
                <Button size="sm" variant="ghost" onClick={() => setAccent(null)}>
                  <X className="h-4 w-4 mr-1" /> Сбросить
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="icon" className="space-y-3">
            <div className="grid grid-cols-8 sm:grid-cols-11 gap-1">
              {ICON_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    'h-10 w-10 rounded-md text-xl flex items-center justify-center hover:bg-accent transition-colors',
                    icon === emoji && 'bg-accent ring-2 ring-primary'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={icon || ''}
                placeholder="Свой эмодзи"
                onChange={(e) => setIcon(e.target.value || null)}
                className="w-32"
                maxLength={4}
              />
              {icon && (
                <Button size="sm" variant="ghost" onClick={() => setIcon(null)}>
                  <X className="h-4 w-4 mr-1" /> Сбросить
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Отмена</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
