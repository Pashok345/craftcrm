import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: 'sm' | 'default';
  className?: string;
}

export const FavoriteButton = ({ isFavorite, onToggle, size = 'sm', className }: FavoriteButtonProps) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'shrink-0',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
    >
      <Star
        className={cn(
          size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
          isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
        )}
      />
    </Button>
  );
};
