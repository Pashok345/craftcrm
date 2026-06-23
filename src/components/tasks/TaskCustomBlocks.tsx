import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Pencil, Check, Upload, Loader2, Type, Image as ImageIcon, Film, FileText, ListChecks, Minus, Heading } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TaskFormBlock, FormContent } from './TaskFormBlock';
import type { BlockType } from './TaskBlocksToolbar';
import { linkifyText } from '@/utils/linkifyText';


export interface TaskContentBlock {
  id: string;
  task_id: string;
  type: BlockType;
  content: any;
  position: number;
  created_by: string;
}

interface Props {
  taskId: string;
  canEdit: boolean;
  registerAddHandler?: (fn: (type: BlockType) => Promise<void>) => void;
}

export const TaskCustomBlocks = ({ taskId, canEdit, registerAddHandler }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<TaskContentBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('task_content_blocks')
      .select('*')
      .eq('task_id', taskId)
      .order('position', { ascending: true });
    setBlocks((data || []) as TaskContentBlock[]);
  };

  useEffect(() => {
    load();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.taskId === taskId) load();
    };
    window.addEventListener('task-blocks-changed', onChange);
    return () => window.removeEventListener('task-blocks-changed', onChange);
  }, [taskId]);

  const addBlock = async (type: BlockType) => {
    if (!user) return;
    const initialContent: Record<BlockType, any> = {
      empty: {},
      heading: { text: 'Новый заголовок' },
      text: { text: '' },
      image: { url: '', caption: '' },
      video: { url: '' },
      divider: {},
      file: { url: '', label: '' },
      form: { title: 'Новая форма', description: '', questions: [] } as FormContent,
    };

    // Find insertion index based on viewport (block closest to center of screen).
    const viewportCenter = window.innerHeight / 2;
    let insertIndex = blocks.length;
    let bestDist = Infinity;
    for (let i = 0; i < blocks.length; i++) {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${blocks[i].id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const blockCenter = rect.top + rect.height / 2;
      const dist = Math.abs(blockCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        // Insert after the block if it's above viewport center, before if below
        insertIndex = blockCenter < viewportCenter ? i + 1 : i;
      }
    }

    const newPosition = insertIndex;
    // Shift positions of blocks at/after insertIndex
    const toShift = blocks.slice(insertIndex);
    if (toShift.length) {
      await Promise.all(
        toShift.map(b =>
          supabase.from('task_content_blocks').update({ position: b.position + 1 }).eq('id', b.id)
        )
      );
    }

    const { data, error } = await supabase
      .from('task_content_blocks')
      .insert({ task_id: taskId, type, content: initialContent[type], position: newPosition, created_by: user.id })
      .select()
      .single();
    if (error) {
      toast({ title: 'Не удалось добавить блок', description: error.message, variant: 'destructive' });
      return;
    }

    const newBlock = data as TaskContentBlock;
    setBlocks(bs => {
      const shifted = bs.map((b, i) => i >= insertIndex ? { ...b, position: b.position + 1 } : b);
      const next = [...shifted];
      next.splice(insertIndex, 0, newBlock);
      return next;
    });

    // Auto-open in edit mode
    if (type === 'text' || type === 'heading') {
      setEditingId(newBlock.id);
      setDraftText('');
    }

    // Scroll the new block into view
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${newBlock.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };


  useEffect(() => {
    registerAddHandler?.(addBlock);
  }, [registerAddHandler, blocks.length, user?.id]);

  const updateBlock = async (id: string, content: any) => {
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, content } : b));
    await supabase.from('task_content_blocks').update({ content }).eq('id', id);
  };

  const deleteBlock = async (id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    await supabase.from('task_content_blocks').delete().eq('id', id);
  };

  const uploadMedia = async (blockId: string, file: File, kind: 'image' | 'video' | 'file') => {
    if (!user) return;
    setUploadingId(blockId);
    try {
      const safe = file.name.replace(/[^\w.-]/g, '_');
      const path = `${taskId}/blocks/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from('task-attachments').upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const block = blocks.find(b => b.id === blockId);
      const url = signed?.signedUrl || '';
      const next = kind === 'file'
        ? { ...block?.content, url, label: file.name }
        : { ...block?.content, url };
      await updateBlock(blockId, next);
    } catch (e: any) {
      toast({ title: 'Ошибка загрузки', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  if (blocks.length === 0) return <div className="hidden" data-empty-blocks />;

  return (
    <div className="space-y-4">
      {blocks.map(block => (
        <div key={block.id} className="relative group/cblock">
          {canEdit && (
            <Button variant="ghost" size="icon"
              onClick={() => deleteBlock(block.id)}
              className="absolute -right-2 -top-2 z-10 h-7 w-7 opacity-0 group-hover/cblock:opacity-100 transition bg-background border shadow"
              title="Удалить блок">
              <X className="h-4 w-4" />
            </Button>
          )}

          {block.type === 'empty' && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-3">Выберите тип блока:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {[
                    { t: 'heading' as const, icon: Heading, label: 'Заголовок' },
                    { t: 'text' as const, icon: Type, label: 'Текст' },
                    { t: 'image' as const, icon: ImageIcon, label: 'Изображение' },
                    { t: 'video' as const, icon: Film, label: 'Видео' },
                    { t: 'file' as const, icon: FileText, label: 'Файл / ссылка' },
                    { t: 'form' as const, icon: ListChecks, label: 'Форма' },
                    { t: 'divider' as const, icon: Minus, label: 'Разделитель' },
                  ].map(({ t, icon: Icon, label }) => (
                    <button
                      key={t}
                      onClick={async () => {
                        const initial: Record<string, any> = {
                          heading: { text: 'Новый заголовок' },
                          text: { text: '' },
                          image: { url: '', caption: '' },
                          video: { url: '' },
                          divider: {},
                          file: { url: '', label: '' },
                          form: { title: 'Новая форма', description: '', questions: [] },
                        };
                        setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, type: t, content: initial[t] } : b));
                        await supabase.from('task_content_blocks')
                          .update({ type: t, content: initial[t] })
                          .eq('id', block.id);
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors text-sm"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {block.type === 'divider' && (
            <div className="py-2"><div className="h-px bg-border" /></div>
          )}



          {block.type === 'heading' && (
            <Card><CardContent className="p-4">
              {editingId === block.id && canEdit ? (
                <div className="flex gap-2">
                  <Input value={draftText} onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Заголовок" className="text-xl font-bold" autoFocus />
                  <Button size="icon" onClick={async () => { await updateBlock(block.id, { text: draftText }); setEditingId(null); }}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2 className="text-xl font-bold cursor-pointer" onClick={() => canEdit && (setEditingId(block.id), setDraftText(block.content?.text || ''))}>
                  {block.content?.text || 'Заголовок'}
                </h2>
              )}
            </CardContent></Card>
          )}

          {block.type === 'text' && (
            <Card><CardContent className="p-4">
              {editingId === block.id && canEdit ? (
                <div className="space-y-2">
                  <Textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={5} autoFocus />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Отмена</Button>
                    <Button size="sm" onClick={async () => { await updateBlock(block.id, { text: draftText }); setEditingId(null); }}>Сохранить</Button>
                  </div>
                </div>
              ) : (
                <div className="group/text relative">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {block.content?.text ? linkifyText(block.content.text) : <span className="text-muted-foreground italic">Пустой текстовый блок</span>}
                  </p>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-7 w-7 opacity-0 group-hover/text:opacity-100"
                      onClick={() => { setEditingId(block.id); setDraftText(block.content?.text || ''); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent></Card>
          )}

          {block.type === 'image' && (
            <Card><CardContent className="p-4 space-y-2">
              {block.content?.url ? (
                <img src={block.content.url} alt={block.content?.caption || ''} className="rounded-lg max-h-[500px] w-full object-contain bg-muted" />
              ) : canEdit ? (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/50">
                  {uploadingId === block.id ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">Загрузить изображение</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadMedia(block.id, e.target.files[0], 'image')} />
                </label>
              ) : null}
              {canEdit && (
                <Input placeholder="Подпись (необязательно)" value={block.content?.caption || ''}
                  onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })} />
              )}
              {block.content?.caption && !canEdit && (
                <p className="text-xs text-muted-foreground text-center">{block.content.caption}</p>
              )}
            </CardContent></Card>
          )}

          {block.type === 'video' && (
            <Card><CardContent className="p-4 space-y-2">
              {block.content?.url ? (
                /youtube\.com|youtu\.be|vimeo\.com/.test(block.content.url) ? (
                  <div className="relative pt-[56.25%]">
                    <iframe
                      src={block.content.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                      className="absolute inset-0 w-full h-full rounded-lg" allowFullScreen />
                  </div>
                ) : (
                  <video src={block.content.url} controls className="w-full rounded-lg max-h-[500px]" />
                )
              ) : canEdit ? (
                <div className="space-y-2">
                  <Input placeholder="URL видео (YouTube, Vimeo или прямая ссылка)"
                    value={block.content?.url || ''}
                    onChange={(e) => updateBlock(block.id, { url: e.target.value })} />
                  <div className="text-center text-xs text-muted-foreground">или</div>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                    {uploadingId === block.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    <span className="text-sm">Загрузить видео</span>
                    <input type="file" accept="video/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadMedia(block.id, e.target.files[0], 'video')} />
                  </label>
                </div>
              ) : null}
            </CardContent></Card>
          )}

          {block.type === 'file' && (
            <Card><CardContent className="p-4">
              {block.content?.url ? (
                <a href={block.content.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline">
                  📎 {block.content?.label || block.content.url}
                </a>
              ) : canEdit ? (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                  {uploadingId === block.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-sm">Загрузить файл</span>
                  <input type="file" className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadMedia(block.id, e.target.files[0], 'file')} />
                </label>
              ) : null}
            </CardContent></Card>
          )}

          {block.type === 'form' && (
            <Card><CardContent className="p-4">
              <TaskFormBlock
                blockId={block.id}
                taskId={taskId}
                content={block.content as FormContent}
                canEdit={canEdit}
                onChange={(next) => updateBlock(block.id, next)}
              />
            </CardContent></Card>
          )}
        </div>
      ))}
    </div>
  );
};
