import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trash2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { MentionInput, parseMentionedUserIds } from '@/components/ui/mention-input';

interface DealComment {
  id: string;
  deal_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    name: string;
    avatar_color: string | null;
  };
}

interface DealCommentsSectionProps {
  dealId: string;
  dealTitle?: string;
}

export const DealCommentsSection = ({ dealId, dealTitle }: DealCommentsSectionProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['deal-comments', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_comments')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_color')
        .in('user_id', userIds);
      
      return data.map(comment => ({
        ...comment,
        profile: profiles?.find(p => p.user_id === comment.user_id)
      })) as DealComment[];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('deal_comments').insert({
        deal_id: dealId,
        user_id: user?.id,
        content,
      });
      if (error) throw error;

      // Handle @mentions
      const { data: allProfiles } = await supabase
        .from('public_profiles')
        .select('user_id, name');
      
      if (allProfiles && user) {
        const mentionedIds = parseMentionedUserIds(content, allProfiles as { user_id: string; name: string }[], user.id);
        const { data: myProfile } = await supabase.from('profiles').select('name').eq('user_id', user.id).single();
        
        for (const mentionedUserId of mentionedIds) {
          await supabase.from('notifications').insert({
            user_id: mentionedUserId,
            type: 'mention',
            title: t('mentionInComment') || 'Згадка в коментарі',
            message: `${myProfile?.name || t('user')} ${t('mentionedYouInComment')}: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-comments', dealId] });
      setNewComment('');
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('deal_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-comments', dealId] });
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">{t('comments')}</h4>
      
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noComments')}</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback
                  style={{ backgroundColor: comment.profile?.avatar_color || '#6366F1' }}
                  className="text-white text-xs"
                >
                  {getInitials(comment.profile?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.profile?.name || t('unknownUser')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: dateLocale })}
                  </span>
                  {comment.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <MentionInput
          value={newComment}
          onChange={setNewComment}
          placeholder={t('writeComment')}
          onSubmit={() => handleSubmit()}
          variant="textarea"
          className="min-h-[60px] resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newComment.trim() || addCommentMutation.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
