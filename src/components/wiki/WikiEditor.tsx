import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Bold, Italic, Underline, Code, Link2, Image as ImageIcon, List, ListOrdered,
  Quote, Minus, Heading1, Heading2, Heading3, Smile,
} from 'lucide-react';

const EMOJIS = [
  '😀','😄','😁','😂','😊','😍','😎','🤩','🥳','🤔','😐','😢','😡','🤯','🤗',
  '👍','👎','👏','🙌','🙏','💪','🤝','👌','✌️','👀','👋','🫶','✍️','☝️','🔥',
  '❤️','💯','⭐','✨','⚡','🌈','🎉','🎯','🏆','💼','✅','❌','⚠️','❗','❓',
  '📌','📎','🔗','📝','📄','📁','📅','⏰','💡','🚀','📊','📈','🧩','🔒','🛠️',
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}

export const WikiEditor = ({ value, onChange, rows = 20, placeholder }: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [imgUrl, setImgUrl] = useState('');

  const apply = (fn: (sel: string) => { text: string; selStart?: number; selEnd?: number }) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const { text, selStart, selEnd } = fn(selected);
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const a = start + (selStart ?? text.length);
      const b = start + (selEnd ?? text.length);
      el?.setSelectionRange(a, b);
    });
  };

  const wrap = (before: string, after = before, ph = 'текст') =>
    apply((sel) => {
      const inner = sel || ph;
      return { text: before + inner + after, selStart: before.length, selEnd: before.length + inner.length };
    });

  const prefixLines = (prefix: string | ((i: number) => string), ph = 'пункт') =>
    apply((sel) => {
      const lines = (sel || ph).split('\n');
      const text = lines.map((l, i) => (typeof prefix === 'string' ? prefix : prefix(i)) + l).join('\n');
      return { text, selStart: 0, selEnd: text.length };
    });

  const insert = (str: string) => apply(() => ({ text: str }));

  const btn = (title: string, Icon: typeof Bold, onClick: () => void) => (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={title} onClick={onClick}>
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
        {btn('Заголовок 1', Heading1, () => prefixLines('# ', 'Заголовок'))}
        {btn('Заголовок 2', Heading2, () => prefixLines('## ', 'Заголовок'))}
        {btn('Заголовок 3', Heading3, () => prefixLines('### ', 'Заголовок'))}
        <Separator orientation="vertical" className="mx-1 h-5" />
        {btn('Жирний (**текст**)', Bold, () => wrap('**'))}
        {btn('Курсив (*текст*)', Italic, () => wrap('*'))}
        {btn('Підкреслений (__текст__)', Underline, () => wrap('__'))}
        {btn('Код (`код`)', Code, () => wrap('`', '`', 'код'))}
        <Separator orientation="vertical" className="mx-1 h-5" />
        {btn('Маркований список', List, () => prefixLines('- '))}
        {btn('Нумерований список', ListOrdered, () => prefixLines((i) => `${i + 1}. `))}
        {btn('Цитата', Quote, () => prefixLines('> ', 'цитата'))}
        {btn('Роздільник', Minus, () => insert('\n---\n'))}
        <Separator orientation="vertical" className="mx-1 h-5" />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Посилання">
              <Link2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <Input placeholder="Текст" value={linkText} onChange={(e) => setLinkText(e.target.value)} />
            <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                if (!linkUrl.trim()) return;
                insert(`[${linkText.trim() || linkUrl.trim()}](${linkUrl.trim()})`);
                setLinkText(''); setLinkUrl(''); setLinkOpen(false);
              }}
            >
              Вставити
            </Button>
          </PopoverContent>
        </Popover>

        <Popover open={imgOpen} onOpenChange={setImgOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Зображення">
              <ImageIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <Input placeholder="Опис" value={imgAlt} onChange={(e) => setImgAlt(e.target.value)} />
            <Input placeholder="https://...jpg" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} />
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                if (!imgUrl.trim()) return;
                insert(`![${imgAlt.trim()}](${imgUrl.trim()})`);
                setImgAlt(''); setImgUrl(''); setImgOpen(false);
              }}
            >
              Вставити
            </Button>
          </PopoverContent>
        </Popover>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Емодзі">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded p-1 text-lg leading-none hover:bg-accent"
                  onClick={() => { insert(e); setEmojiOpen(false); }}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          title="Блок коду"
          onClick={() => insert('\n```\nкод\n```\n')}
        >
          {'</>'}
        </Button>
      </div>

      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="rounded-none rounded-b-md border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          const k = e.key.toLowerCase();
          if (k === 'b') { e.preventDefault(); wrap('**'); }
          if (k === 'i') { e.preventDefault(); wrap('*'); }
          if (k === 'u') { e.preventDefault(); wrap('__'); }
        }}
      />
    </div>
  );
};
