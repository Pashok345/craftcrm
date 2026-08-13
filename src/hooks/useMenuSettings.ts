import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_MENU,
  MENU_PREF_KEY,
  MenuOverrides,
} from '@/lib/menuConfig';
import {
  fetchUserPreferences,
  readCachedPrefs,
  setUserPreference,
} from '@/lib/userPreferences';

const MENU_CHANGED_EVENT = 'menu-config-changed';

export const useMenuSettings = () => {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<MenuOverrides>(
    () => (readCachedPrefs(null)[MENU_PREF_KEY] as MenuOverrides) || {}
  );

  const applyCache = useCallback((uid?: string | null) => {
    const prefs = readCachedPrefs(uid);
    setOverrides((prefs[MENU_PREF_KEY] as MenuOverrides) || {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    applyCache(user.id);
    fetchUserPreferences(user.id).then((prefs) => {
      setOverrides((prefs[MENU_PREF_KEY] as MenuOverrides) || {});
    });
  }, [user?.id, applyCache]);

  useEffect(() => {
    const handler = () => applyCache(user?.id);
    window.addEventListener(MENU_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MENU_CHANGED_EVENT, handler);
  }, [user?.id, applyCache]);

  const save = useCallback(
    async (next: MenuOverrides) => {
      setOverrides(next);
      await setUserPreference(user?.id, MENU_PREF_KEY, next);
      window.dispatchEvent(new Event(MENU_CHANGED_EVENT));
    },
    [user?.id]
  );

  const reset = useCallback(() => save({}), [save]);

  return { items: DEFAULT_MENU, overrides, save, reset };
};
