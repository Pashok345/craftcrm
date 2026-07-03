import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { linkifyText } from '@/utils/linkifyText';

interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
interface ProfileMini {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
}

const initials = (n?: string | null) =>
  (n || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

export const ProjectComments = ({ projectId }: { projectId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    const rows = (data || []) as Comment[];
    setComments(rows);
    const ids = [...new Set(rows.map(r => r.user_id))];
    if (ids.length) {
      const { data: p } = await supabase
        .from('public_profiles')
        .select('user_id, name, avatar_url, avatar_color')
        .in('user_id', ids);
      const map: Record<string, ProfileMini> = {};
      (p || []).forEach((row: any) => { map[row.user_id] = row; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from('project_comments').insert({
      project_id: projectId,
      user_id: user.id,
      content: text.trim(),
    });
    if (error) {
      toast({ title: 'Помилка', description: error.message, variant: 'destructive' });
    } else {
      setText('');
      load();
    }
    setSending(false);
  };

  const remove = async (c: Comment) => {
    if (!confirm('Видалити коментар?')) return;
    await supabase.from('project_comments').delete().eq('id', c.id);
    load();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Коментарі проекту</h3>

      {loading ? (
        <div className="text-center py-6"><Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" /></div>
      ) : comments.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">Ще немає коментарів</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => {
            const p = profiles[c.user_id];
            return (
              <div key={c.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={p?.avatar_url || undefined} />
                  <AvatarFallback style={{ backgroundColor: p?.avatar_color || '#6366f1' }} className="text-white text-xs">
                    {initials(p?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{p?.name || 'Користувач'}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), 'd MMM yyyy HH:mm', { locale: ru })}
                    </span>
                    {c.user_id === user?.id && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => remove(c)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                    {linkifyText(c.content)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написати коментар..."
          className="min-h-[60px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
          }}
        />
        <Button onClick={send} disabled={!text.trim() || sending} className="self-end">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
