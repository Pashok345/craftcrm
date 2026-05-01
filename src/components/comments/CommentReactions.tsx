import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '🙏'];

export type CommentType = 'task' | 'deal' | 'proposal';

interface Reaction {
  id: string;
  comment_type: CommentType;
  comment_id: string;
  user_id: string;
  emoji: string;
}

interface Props {
  commentType: CommentType;
  commentId: string;
}

export const CommentReactions = ({ commentType, commentId }: Props) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('comment_reactions')
      .select('*')
      .eq('comment_type', commentType)
      .eq('comment_id', commentId);
    if (data) setReactions(data as Reaction[]);
  };

  useEffect(() => {
    fetchReactions();
    const channel = supabase
      .channel(`comment-reactions-${commentType}-${commentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_reactions', filter: `comment_id=eq.${commentId}` },
        () => fetchReactions()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentType, commentId]);

  const toggle = async (emoji: string) => {
    if (!user) return;
    const existing = reactions.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('comment_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('comment_reactions').insert({
        comment_type: commentType,
        comment_id: commentId,
        user_id: user.id,
        emoji,
      });
    }
    setOpen(false);
    fetchReactions();
  };

  const grouped = reactions.reduce<Record<string, { count: number; hasOwn: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasOwn: false };
    acc[r.emoji].count++;
    if (r.user_id === user?.id) acc[r.emoji].hasOwn = true;
    return acc;
  }, {});

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {Object.entries(grouped).map(([emoji, data]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => toggle(emoji)}
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
          <button
            type="button"
            className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top">
          <div className="flex gap-1">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => toggle(emoji)}
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
