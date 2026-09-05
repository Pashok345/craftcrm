import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const PATHS: Record<string, (id: string) => string> = {
  task: (id) => `/tasks/${id}`,
  deal: (id) => `/sales/deals/${id}`,
  project: (id) => `/projects`,
  client: () => `/sales`,
  meeting: () => `/meetings`,
};

/** Polls the user's reminders and shows a toast when one becomes due. */
export const RemindersWatcher = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: due = [] } = useQuery({
    queryKey: ['due-reminders', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('id, title, entity_type, entity_id')
        .eq('user_id', user!.id)
        .eq('is_done', false)
        .lte('remind_at', new Date().toISOString());
      if (error) throw error;
      return (data || []) as { id: string; title: string; entity_type: string; entity_id: string | null }[];
    },
  });

  useEffect(() => {
    if (due.length === 0) return;
    (async () => {
      for (const r of due) {
        const path = r.entity_id ? PATHS[r.entity_type]?.(r.entity_id) : undefined;
        toast('Напоминание', {
          description: r.title,
          duration: 15000,
          action: path ? { label: 'Открыть', onClick: () => navigate(path) } : undefined,
        });
      }
      await supabase
        .from('reminders')
        .update({ is_done: true })
        .in('id', due.map((r) => r.id));
      queryClient.invalidateQueries({ queryKey: ['due-reminders'] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);

  return null;
};
