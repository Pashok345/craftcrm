import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '🙏'];

interface MessageReactionsProps {
  messageId: string;
  isOwn: boolean;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export const MessageReactions = ({ messageId, isOwn }: MessageReactionsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: reactions = [] } = useQuery({
    queryKey: ['message-reactions', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId);
      if (error) throw error;
      return data as Reaction[];
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      const existing = reactions.find(r => r.user_id === user?.id && r.emoji === emoji);
      if (existing) {
        const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: user?.id,
          emoji,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', messageId] });
      setOpen(false);
    },
  });

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, { count: number; hasOwn: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasOwn: false };
    acc[r.emoji].count++;
    if (r.user_id === user?.id) acc[r.emoji].hasOwn = true;
    return acc;
  }, {});

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', isOwn ? 'justify-end' : 'justify-start')}>
      {Object.entries(grouped).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => toggleReaction.mutate(emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
            data.hasOwn
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted border-border hover:bg-muted/80'
          )}
        >
          <span>{emoji}</span>
          <span>{data.count}</span>
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
            <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side={isOwn ? 'left' : 'right'}>
          <div className="flex gap-1">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => toggleReaction.mutate(emoji)}
                className="p-1.5 rounded hover:bg-muted transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
