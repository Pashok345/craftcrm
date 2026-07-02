import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Bold, Italic, Underline, Smile, List } from 'lucide-react';

const EMOJIS = [
  '😀','😄','😁','😅','😂','🤣','😊','😍','😘','😎','🤩','🥳','🤔','😐','😴','😢','😭','😡','🤯','🤗',
  '👍','👎','👏','🙌','🙏','💪','🫡','🤝','👌','✌️','🤞','🖖','👀','👋','🫶','🫰','🤟','☝️','✍️','🫵',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','🔥','⭐','🌟','✨','⚡','☀️','🌈','☕','🎉','🎊',
  '✅','❌','⚠️','❗','❓','📌','📍','📎','🔗','📝','📄','📁','📅','⏰','⌛','💡','🚀','🎯','🏆','💼',
];

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
};

// Very small, safe markdown-ish renderer.
// Supports **bold**, *italic*, __underline__, links, and preserves line breaks.
export const renderFormattedText = (text: string) => {
  if (!text) return null;
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^\n*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^\n_]+)__/g, '<u>$1</u>');
  html = html.replace(/(^|[\s(])\*([^\n*]+)\*(?=[\s.,!?):]|$)/g, '$1<em>$2</em>');
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>'
  );
  html = html.replace(/\n/g, '<br />');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const RichTextEditor = ({ value, onChange, onSave, onCancel }: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const wrap = (before: string, after: string = before) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end) || 'текст';
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertAtCursor = (str: string) => {
    const el = ref.current;
    if (!el) {
      onChange(value + str);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + str + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + str.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 border rounded-md p-1 bg-muted/40">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Жирный (**текст**)" onClick={() => wrap('**')}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Курсив (*текст*)" onClick={() => wrap('*')}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Подчёркнутый (__текст__)" onClick={() => wrap('__')}>
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Список" onClick={() => insertAtCursor('\n• ')}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Эмодзи">
              <Smile className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { insertAtCursor(e); setEmojiOpen(false); }}
                  className="text-lg hover:bg-accent rounded p-1 leading-none"
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        autoFocus
        placeholder="Введите текст. Форматирование: **жирный**, *курсив*, __подчёркнутый__"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Отмена</Button>
        <Button size="sm" onClick={onSave}>Сохранить</Button>
      </div>
    </div>
  );
};
