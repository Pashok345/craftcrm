import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ENTITY_TYPE = 'task_pin';

/** Pinned tasks are stored in the shared `favorites` table with a dedicated entity type. */
export const usePinnedTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pinned = [] } = useQuery({
    queryKey: ['pinned-tasks', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('id, entity_id')
        .eq('user_id', user!.id)
        .eq('entity_type', ENTITY_TYPE);
      if (error) throw error;
      return (data || []) as { id: string; entity_id: string }[];
    },
  });

  const isPinned = useCallback((taskId: string) => pinned.some((p) => p.entity_id === taskId), [pinned]);

  const togglePin = useCallback(
    async (taskId: string) => {
      if (!user?.id) return;
      const existing = pinned.find((p) => p.entity_id === taskId);
      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, entity_type: ENTITY_TYPE, entity_id: taskId });
      }
      queryClient.invalidateQueries({ queryKey: ['pinned-tasks', user.id] });
    },
    [pinned, user, queryClient]
  );

  return { pinned, isPinned, togglePin };
};
