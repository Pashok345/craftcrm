// Persist per-column color overrides (works for built-in columns without db_id)
const KEY = 'kanban-column-colors-v1';

export const loadColumnColorOverrides = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const saveColumnColorOverride = (columnId: string, color: string) => {
  const map = loadColumnColorOverrides();
  map[columnId] = color;
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {}
};

export const getColumnColor = (columnId: string, fallback: string): string => {
  const map = loadColumnColorOverrides();
  return map[columnId] || fallback;
};
