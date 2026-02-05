import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface ProposalCommentsSectionProps {
  proposalId: string;
}

interface ProposalComment {
  id: string;
  proposal_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  name: string;
  avatar_url?: string;
  avatar_color?: string;
}

export const ProposalCommentsSection = ({ proposalId }: ProposalCommentsSectionProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['proposal-comments', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_comments')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ProposalComment[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['public-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, name, avatar_url, avatar_color');
      if (error) throw error;
      return data as Profile[];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('proposal_comments').insert({
        proposal_id: proposalId,
        user_id: user?.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-comments', proposalId] });
      setNewComment('');
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('proposal_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-comments', proposalId] });
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const getProfile = (userId: string) => {
    return profiles.find((p) => p.user_id === userId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">{t('comments')}</h4>

      <ScrollArea className="h-48 pr-4">
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('noComments')}
            </p>
          ) : (
            comments.map((comment) => {
              const profile = getProfile(comment.user_id);
              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback
                      style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}
                      className="text-xs text-white"
                    >
                      {getInitials(profile?.name || t('unknownUser'))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {profile?.name || t('unknownUser')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'd MMM HH:mm', { locale: uk })}
                        </span>
                      </div>
                      {comment.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('writeComment')}
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
