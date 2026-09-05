import { useCallback, useEffect, useState } from 'react';

export interface RecentItem {
  type: 'task' | 'project' | 'deal' | 'client' | 'wiki' | 'process' | 'run' | 'whiteboard';
  id: string;
  title: string;
  path: string;
  at: number;
}

const KEY = 'recently-viewed-v1';
const MAX = 8;
const EVENT = 'recently-viewed-changed';

const read = (): RecentItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
};

export const pushRecentlyViewed = (item: Omit<RecentItem, 'at'>) => {
  if (!item.id || !item.title) return;
  const list = read().filter((r) => !(r.type === item.type && r.id === item.id));
  list.unshift({ ...item, at: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
};

/** Registers the current entity as "recently opened" and exposes the history list. */
export const useRecentlyViewed = (current?: Omit<RecentItem, 'at'>) => {
  const [items, setItems] = useState<RecentItem[]>(read);

  useEffect(() => {
    const handler = () => setItems(read());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  useEffect(() => {
    if (current?.id && current?.title) pushRecentlyViewed(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.type, current?.id, current?.title]);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { items, clear };
};
