import { useState } from 'react';
import { Share2, Copy, Check, Facebook, Send as SendIcon, Twitter, Linkedin, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Props = {
  type: 'project' | 'task';
  id: string;
  title: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'icon';
  compact?: boolean;
};

export function ShareButton({ type, id, title, variant = 'outline', size = 'sm', compact }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Public preview URL served by edge function — social crawlers see OG tags,
  // real users get redirected into the app.
  const shareUrl = `${SUPABASE_URL}/functions/v1/share-preview?type=${type}&id=${id}`;
  const shareText = title;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Ссылка скопирована' });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: 'Не удалось скопировать', variant: 'destructive' });
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: shareText, url: shareUrl });
        setOpen(false);
        return true;
      } catch {}
    }
    return false;
  };

  const socials = [
    {
      key: 'telegram',
      label: 'Telegram',
      icon: SendIcon,
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={async (e) => {
            e.stopPropagation();
            const handled = await nativeShare();
            if (handled) e.preventDefault();
          }}
          className={compact ? 'h-8 w-8 p-0' : ''}
          title="Поделиться"
        >
          <Share2 className={compact ? 'h-4 w-4' : 'h-4 w-4 mr-1'} />
          {!compact && 'Поделиться'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          {socials.map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm"
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </a>
          ))}
          <div className="h-px bg-border my-1" />
          <button
            onClick={copy}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-left"
          >
            {copied ? <Check className="h-4 w-4 text-crm-success" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm"
          >
            <Link2 className="h-4 w-4" />
            Открыть превью
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
