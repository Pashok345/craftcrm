import { Plus, Type, Image as ImageIcon, Film, Minus, FileText, ListChecks, Heading } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type BlockType = 'heading' | 'text' | 'image' | 'video' | 'divider' | 'file' | 'form';

interface Props {
  onAdd: (type: BlockType) => void;
}

const ITEMS: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: 'heading', icon: Heading, label: 'Заголовок' },
  { type: 'text', icon: Type, label: 'Текст' },
  { type: 'image', icon: ImageIcon, label: 'Изображение' },
  { type: 'video', icon: Film, label: 'Видео' },
  { type: 'file', icon: FileText, label: 'Файл / ссылка' },
  { type: 'form', icon: ListChecks, label: 'Форма с вопросами' },
  { type: 'divider', icon: Minus, label: 'Разделитель' },
];

export const TaskBlocksToolbar = ({ onAdd }: Props) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="sticky top-24 z-20 flex flex-col items-center gap-1 rounded-2xl border bg-background/95 backdrop-blur p-1.5 shadow-lg">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              title="Добавить блок"
              aria-label="Добавить блок"
            >
              <Plus className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-56 p-1">
            <div className="text-xs text-muted-foreground px-2 py-1.5">Добавить блок</div>
            {ITEMS.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => onAdd(type)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-accent text-left"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="h-px w-7 bg-border my-1" />

        {ITEMS.map(({ type, icon: Icon, label }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onAdd(type)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label={label}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
