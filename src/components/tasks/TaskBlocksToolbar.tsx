import { Plus, Type, Image as ImageIcon, Film, Minus, FileText, ListChecks, Heading, Link2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export type BlockType = 'empty' | 'heading' | 'text' | 'image' | 'video' | 'divider' | 'file' | 'form';

interface OptionalBlock {
  id: string;
  label: string;
}

interface Props {
  onAdd: (type: BlockType) => void;
  optionalBlocks?: OptionalBlock[];
  onToggleOptional?: (id: string) => void;
}

const QUICK_ITEMS: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: 'heading', icon: Heading, label: 'Заголовок' },
  { type: 'text', icon: Type, label: 'Текст' },
  { type: 'image', icon: ImageIcon, label: 'Изображение' },
  { type: 'video', icon: Film, label: 'Видео' },
  { type: 'file', icon: FileText, label: 'Файл / ссылка' },
  { type: 'form', icon: ListChecks, label: 'Форма с вопросами' },
  { type: 'divider', icon: Minus, label: 'Разделитель' },
];

const OPTIONAL_ICONS: Record<string, React.ElementType> = {
  dependencies: Link2,
  timeTracker: Clock,
};

export const TaskBlocksToolbar = ({ onAdd, optionalBlocks = [], onToggleOptional }: Props) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-center gap-1 rounded-2xl border bg-background/95 backdrop-blur p-1.5 shadow-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onAdd('empty')}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition shadow"
              aria-label="Добавить блок"
            >
              <Plus className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Добавить блок</TooltipContent>
        </Tooltip>

        <div className="h-px w-7 bg-border my-1" />

        {QUICK_ITEMS.map(({ type, icon: Icon, label }) => (
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

        {optionalBlocks.length > 0 && onToggleOptional && (
          <>
            <div className="h-px w-7 bg-border my-1" />
            {optionalBlocks.map(({ id, label }) => {
              const Icon = OPTIONAL_ICONS[id] || Plus;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onToggleOptional(id)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      aria-label={label}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </>
        )}
      </div>
    </TooltipProvider>
  );
};
