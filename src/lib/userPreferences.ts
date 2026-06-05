import { supabase } from '@/integrations/supabase/client';

/**
 * Per-user UI preferences persisted via profiles.ui_preferences (jsonb).
 * Also cached in localStorage for instant reads on page load.
 *
 * Common keys:
 *  - kanban_column_order: string[]    // ids of kanban columns in user-chosen order
 *  - task_detail_enabled_blocks: string[] // additional opt-in blocks shown on a task page
 */
export type UIPreferences = Record<string, any>;

const cacheKey = (userId?: string | null) => `ui_prefs_v1:${userId || 'guest'}`;

export const readCachedPrefs = (userId?: string | null): UIPreferences => {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeCachedPrefs = (userId: string | null | undefined, prefs: UIPreferences) => {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(prefs));
  } catch {}
};

export const fetchUserPreferences = async (userId: string): Promise<UIPreferences> => {
  const { data } = await supabase
    .from('profiles')
    .select('ui_preferences')
    .eq('user_id', userId)
    .maybeSingle();
  const prefs = ((data as any)?.ui_preferences as UIPreferences) || {};
  writeCachedPrefs(userId, prefs);
  return prefs;
};

export const setUserPreference = async (
  userId: string | null | undefined,
  key: string,
  value: any
) => {
  // Optimistically update cache
  const current = readCachedPrefs(userId);
  const next = { ...current, [key]: value };
  writeCachedPrefs(userId, next);
  if (!userId) return;
  await supabase.from('profiles').update({ ui_preferences: next as any }).eq('user_id', userId);
};
