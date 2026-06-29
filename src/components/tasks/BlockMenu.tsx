import { MoreHorizontal, Pencil, Palette, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const BG_COLORS = [
  { v: '', label: 'Нет' },
  { v: '#fef3c7', label: 'Кремовый' },
  { v: '#dbeafe', label: 'Голубой' },
  { v: '#dcfce7', label: 'Мятный' },
  { v: '#fce7f3', label: 'Розовый' },
  { v: '#ede9fe', label: 'Лавандовый' },
  { v: '#fee2e2', label: 'Персиковый' },
  { v: '#f1f5f9', label: 'Серый' },
  { v: '#1e293b', label: 'Тёмный' },
];

const BORDER_COLORS = [
  { v: '', label: 'Нет' },
  { v: '#3b82f6', label: 'Синий' },
  { v: '#22c55e', label: 'Зелёный' },
  { v: '#eab308', label: 'Жёлтый' },
  { v: '#f97316', label: 'Оранжевый' },
  { v: '#ef4444', label: 'Красный' },
  { v: '#a855f7', label: 'Фиолетовый' },
  { v: '#ec4899', label: 'Розовый' },
  { v: '#06b6d4', label: 'Голубой' },
];

interface Props {
  bgColor?: string;
  borderColor?: string;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  onStyleChange: (next: { bgColor?: string; borderColor?: string }) => void;
}

export const BlockMenu = ({ bgColor, borderColor, canEdit, onEdit, onDelete, onStyleChange }: Props) => {
  const [customOpen, setCustomOpen] = useState(false);
  return (
    <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-40 group-hover/block:opacity-100 transition-opacity">
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 space-y-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Цвет фона</div>
            <div className="flex flex-wrap gap-1.5">
              {BG_COLORS.map((c) => (
                <button
                  key={c.v || 'none'}
                  type="button"
                  title={c.label}
                  onClick={() => onStyleChange({ bgColor: c.v, borderColor })}
                  className={cn(
                    'w-7 h-7 rounded-md border-2 flex items-center justify-center text-xs',
                    bgColor === c.v ? 'border-foreground scale-110' : 'border-border'
                  )}
                  style={{ backgroundColor: c.v || 'transparent' }}
                >
                  {!c.v && '✕'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Цвет рамки</div>
            <div className="flex flex-wrap gap-1.5">
              {BORDER_COLORS.map((c) => (
                <button
                  key={c.v || 'none'}
                  type="button"
                  title={c.label}
                  onClick={() => onStyleChange({ bgColor, borderColor: c.v })}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs',
                    borderColor === c.v ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c.v || 'transparent', borderColor: c.v ? undefined : 'hsl(var(--border))' }}
                >
                  {!c.v && '✕'}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-background border shadow"
            title="Меню блока"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEdit && onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Редактировать
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setCustomOpen(true)}>
            <Palette className="h-4 w-4 mr-2" /> Кастомизация
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
