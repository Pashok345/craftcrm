import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Pencil, Check, Upload, Loader2, Type, Image as ImageIcon, Film, FileText, ListChecks, Minus, Heading, GripVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TaskFormBlock, FormContent } from './TaskFormBlock';
import type { BlockType } from './TaskBlocksToolbar';
import { linkifyText } from '@/utils/linkifyText';
import { AttachmentImage } from '@/components/ui/attachment-image';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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
  registerAddHandler?: (fn: (type: BlockType, atIndex?: number) => Promise<void>) => void;
  registerBlocksGetter?: (fn: () => TaskContentBlock[]) => void;
}

const INITIAL_CONTENT: Record<BlockType, any> = {
  empty: {},
  heading: { text: 'Новый заголовок' },
  text: { text: '' },
  image: { url: '', caption: '' },
  video: { url: '' },
  divider: {},
  file: { url: '', label: '' },
  form: { title: 'Новая форма', description: '', questions: [] } as FormContent,
};

const blockShortLabel = (b: TaskContentBlock): string => {
  switch (b.type) {
    case 'heading': return b.content?.text || 'Заголовок';
    case 'text': return (b.content?.text || 'Текстовый блок').slice(0, 40);
    case 'image': return b.content?.caption ? `Изображение: ${b.content.caption}` : 'Изображение';
    case 'video': return 'Видео';
    case 'file': return b.content?.label || 'Файл';
    case 'form': return b.content?.title || 'Форма';
    case 'divider': return 'Разделитель';
    case 'empty': return 'Новый блок';
  }
};

export const TaskCustomBlocks = ({ taskId, canEdit, registerAddHandler, registerBlocksGetter }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<TaskContentBlock[]>([]);
  const blocksRef = useRef<TaskContentBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Position picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<BlockType | null>(null);
  const [pickerIndex, setPickerIndex] = useState<string>('end');

  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

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

  const addBlock = async (type: BlockType, atIndex?: number) => {
    if (!user) return;

    const current = blocksRef.current;
    const insertIndex = typeof atIndex === 'number'
      ? Math.max(0, Math.min(atIndex, current.length))
      : current.length;

    const newPosition = insertIndex;
    const toShift = current.slice(insertIndex);
    if (toShift.length) {
      await Promise.all(
        toShift.map(b =>
          supabase.from('task_content_blocks').update({ position: b.position + 1 }).eq('id', b.id)
        )
      );
    }

    const { data, error } = await supabase
      .from('task_content_blocks')
      .insert({ task_id: taskId, type, content: INITIAL_CONTENT[type], position: newPosition, created_by: user.id })
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

    if (type === 'text' || type === 'heading') {
      setEditingId(newBlock.id);
      setDraftText('');
    }

    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${newBlock.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Register external handlers
  useEffect(() => {
    registerAddHandler?.((type, atIndex) => addBlock(type, atIndex));
    registerBlocksGetter?.(() => blocksRef.current);
  }, [registerAddHandler, registerBlocksGetter, user?.id]);

  // Listen for position-picker request from toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: BlockType };
      if (!detail?.type) return;
      if (blocksRef.current.length === 0) {
        addBlock(detail.type, 0);
        return;
      }
      setPickerType(detail.type);
      setPickerIndex(String(blocksRef.current.length));
      setPickerOpen(true);
    };
    window.addEventListener('task-block-add-request', handler);
    return () => window.removeEventListener('task-block-add-request', handler);
  }, [user?.id]);

  const updateBlock = async (id: string, content: any) => {
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, content } : b));
    await supabase.from('task_content_blocks').update({ content }).eq('id', id);
  };

  const deleteBlock = async (id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    await supabase.from('task_content_blocks').delete().eq('id', id);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const reordered = Array.from(blocks);
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const withPos = reordered.map((b, i) => ({ ...b, position: i }));
    setBlocks(withPos);
    await Promise.all(
      withPos.map(b =>
        supabase.from('task_content_blocks').update({ position: b.position }).eq('id', b.id)
      )
    );
  };

  const uploadMedia = async (blockId: string, file: File, kind: 'image' | 'video' | 'file') => {
    if (!user) return;
    setUploadingId(blockId);
    try {
      const safe = file.name.replace(/[^\w.-]/g, '_');
      const path = `${taskId}/blocks/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('task-attachments').upload(path, file);
      if (upErr) throw upErr;
      // Store the raw storage path so AttachmentImage can resolve it via SDK download
      const block = blocksRef.current.find(b => b.id === blockId);
      const next = kind === 'file'
        ? { ...block?.content, url: path, label: file.name }
        : { ...block?.content, url: path };
      await updateBlock(blockId, next);
      toast({ title: 'Файл загружен' });
    } catch (e: any) {
      console.error('uploadMedia error', e);
      toast({ title: 'Ошибка загрузки', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const renderBlockBody = (block: TaskContentBlock) => (
    <>
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
                    setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, type: t, content: INITIAL_CONTENT[t] } : b));
                    await supabase.from('task_content_blocks')
                      .update({ type: t, content: INITIAL_CONTENT[t] })
                      .eq('id', block.id);
                    if (t === 'heading' || t === 'text') {
                      setEditingId(block.id);
                      setDraftText('');
                    }
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
            <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              <AttachmentImage fileUrl={block.content.url} fileName={block.content?.caption || 'image'} />
            </div>
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
    </>
  );

  const PositionPicker = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Куда вставить блок?</DialogTitle>
          <DialogDescription>Выберите позицию нового блока среди существующих.</DialogDescription>
        </DialogHeader>
        <Select value={pickerIndex} onValueChange={setPickerIndex}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">В начале</SelectItem>
            {blocks.map((b, i) => (
              <SelectItem key={b.id} value={String(i + 1)}>
                После: {blockShortLabel(b)}
              </SelectItem>
            ))}
            <SelectItem value={String(blocks.length)}>В конце</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPickerOpen(false)}>Отмена</Button>
          <Button onClick={async () => {
            const t = pickerType;
            const idx = parseInt(pickerIndex, 10);
            setPickerOpen(false);
            setPickerType(null);
            if (t) await addBlock(t, isNaN(idx) ? undefined : idx);
          }}>Добавить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (blocks.length === 0) {
    return (
      <>
        {canEdit && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => addBlock('empty', 0)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              <span className="text-lg leading-none">+</span> Добавить блок
            </button>
          </div>
        )}
        {PositionPicker}
      </>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="custom-blocks">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {blocks.map((block, idx) => (
                <Draggable key={block.id} draggableId={block.id} index={idx} isDragDisabled={!canEdit}>
                  {(prov) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      data-block-id={block.id}
                      className="relative group/cblock"
                    >
                      {canEdit && (
                        <div
                          {...prov.dragHandleProps}
                          className="absolute -left-7 top-2 z-10 h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing opacity-0 group-hover/cblock:opacity-100 transition"
                          title="Перетащить"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="icon"
                          onClick={() => deleteBlock(block.id)}
                          className="absolute -right-2 -top-2 z-10 h-7 w-7 opacity-0 group-hover/cblock:opacity-100 transition bg-background border shadow"
                          title="Удалить блок">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {renderBlockBody(block)}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {PositionPicker}
    </>
  );
};
