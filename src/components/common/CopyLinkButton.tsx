import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  /** Path inside the app, e.g. /tasks/123. Defaults to the current page. */
  path?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  compact?: boolean;
}

export const CopyLinkButton = ({ path, label = 'Копировать ссылку', variant = 'outline', compact }: Props) => {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${path || window.location.pathname}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  return (
    <Button variant={variant} size={compact ? 'icon' : 'sm'} onClick={copy} title={label} aria-label={label}>
      {copied ? <Check className="h-4 w-4 text-crm-success" /> : <Link2 className="h-4 w-4" />}
      {!compact && <span className="ml-1">{label}</span>}
    </Button>
  );
};
