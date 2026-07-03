import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Upload, Pin, PinOff, Trash2, Download, FileIcon, Loader2 } from 'lucide-react';
import { ImageThumbnail, isImageFile } from '@/components/ui/image-lightbox';
import { format } from 'date-fns';

interface Attachment {
  id: string;
  project_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  is_pinned: boolean;
  created_at: string;
  signedUrl?: string;
}

const formatSize = (n?: number | null) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const ProjectAttachments = ({ projectId }: { projectId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('project_attachments')
      .select('*')
      .eq('project_id', projectId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    const rows = (data || []) as Attachment[];
    // sign urls
    const signed = await Promise.all(
      rows.map(async (r) => {
        const { data: s } = await supabase.storage
          .from('project-attachments')
          .createSignedUrl(r.file_path, 3600);
        return { ...r, signedUrl: s?.signedUrl };
      })
    );
    setItems(signed);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploading(true);
    for (const file of files) {
      const path = `${projectId}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('project-attachments')
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast({ title: 'Помилка завантаження', description: upErr.message, variant: 'destructive' });
        continue;
      }
      const { error: dbErr } = await supabase.from('project_attachments').insert({
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
      });
      if (dbErr) {
        toast({ title: 'Помилка збереження', description: dbErr.message, variant: 'destructive' });
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    load();
  };

  const togglePin = async (a: Attachment) => {
    await supabase.from('project_attachments').update({ is_pinned: !a.is_pinned }).eq('id', a.id);
    load();
  };

  const remove = async (a: Attachment) => {
    if (!confirm(`Видалити файл "${a.file_name}"?`)) return;
    await supabase.storage.from('project-attachments').remove([a.file_path]);
    await supabase.from('project_attachments').delete().eq('id', a.id);
    load();
  };

  const download = async (a: Attachment) => {
    if (!a.signedUrl) return;
    const res = await fetch(a.signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.file_name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const pinned = items.filter(i => i.is_pinned);
  const others = items.filter(i => !i.is_pinned);

  const renderItem = (a: Attachment) => {
    const isImg = isImageFile(a.file_type, a.file_name);
    return (
      <div key={a.id} className="border rounded-lg p-3 flex flex-col gap-2 bg-card">
        {isImg && a.signedUrl ? (
          <ImageThumbnail src={a.signedUrl} alt={a.file_name} className="w-full h-32 object-cover" />
        ) : (
          <div className="w-full h-32 flex items-center justify-center bg-muted rounded">
            <FileIcon className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="text-sm font-medium truncate" title={a.file_name}>{a.file_name}</div>
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>{formatSize(a.file_size)}</span>
          <span>{format(new Date(a.created_at), 'dd.MM.yy')}</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => download(a)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => togglePin(a)}
            title={a.is_pinned ? 'Відкріпити' : 'Закріпити'}>
            {a.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          {(a.uploaded_by === user?.id) && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => remove(a)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Файли проекту</h3>
        <div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={onFile} />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Завантажити
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 mx-auto animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Немає файлів</p>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Pin className="h-3 w-3" /> Закріплені
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {pinned.map(renderItem)}
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <div className="text-xs uppercase text-muted-foreground mb-2">Всі файли</div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {others.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
