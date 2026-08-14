import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

export function DateFieldPicker({ value, onChange, disabled, invalid, className }: Props) {
  const { t } = useLanguage();
  const parsed = value ? parseISO(value) : undefined;
  const date = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            invalid && 'border-destructive focus-visible:ring-destructive',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd.MM.yyyy') : <span>{t('selectDate')}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(format(d, 'yyyy-MM-dd'))}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
