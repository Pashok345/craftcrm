import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Favorite {
  id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export const useFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setFavorites((data as Favorite[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorite = useCallback(
    (entityType: string, entityId: string) =>
      favorites.some((f) => f.entity_type === entityType && f.entity_id === entityId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (entityType: string, entityId: string) => {
      if (!user) return;
      const existing = favorites.find(
        (f) => f.entity_type === entityType && f.entity_id === entityId
      );
      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
      } else {
        const { data } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId })
          .select()
          .single();
        if (data) setFavorites((prev) => [data as Favorite, ...prev]);
      }
    },
    [user, favorites]
  );

  return { favorites, loading, isFavorite, toggleFavorite, refetch: fetchFavorites };
};
