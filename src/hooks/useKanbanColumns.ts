import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskStatus } from '@/types/database';
import { loadColumnColorOverrides } from '@/lib/columnColors';

export interface KanbanColumn {
  id: string;
  db_id?: string;
  title: string; // may be i18n key like 'statusTodo' for built-ins
  status: string;
  color: string;
  is_default: boolean;
}

export const DEFAULT_COLUMN_COLOR = 'hsl(var(--muted))';

export const BUILT_IN_COLUMN_COLORS: Record<string, string> = {
  todo: 'hsl(220 14% 75% / 0.55)',
  in_progress: 'hsl(38 92% 70% / 0.55)',
  review: 'hsl(221 83% 70% / 0.55)',
  done: 'hsl(142 60% 65% / 0.55)',
};

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'col-todo', title: 'statusTodo', status: 'todo', color: BUILT_IN_COLUMN_COLORS.todo, is_default: true },
  { id: 'col-in_progress', title: 'statusInProgress', status: 'in_progress', color: BUILT_IN_COLUMN_COLORS.in_progress, is_default: true },
  { id: 'col-review', title: 'statusReview', status: 'review', color: BUILT_IN_COLUMN_COLORS.review, is_default: true },
  { id: 'col-done', title: 'statusDone', status: 'done', color: BUILT_IN_COLUMN_COLORS.done, is_default: true },
];

const BUILT_IN: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
const isBuiltIn = (s: string): s is TaskStatus => BUILT_IN.includes(s as TaskStatus);

export const KANBAN_CHANGED_EVENT = 'kanban-changed';

const applyOrder = (cols: KanbanColumn[]): KanbanColumn[] => {
  try {
    const saved = localStorage.getItem('kanban-column-order-v1');
    if (!saved) return cols;
    const order: string[] = JSON.parse(saved);
    return [...cols].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 999 + cols.findIndex(c => c.id === a.id) : ai) -
        (bi === -1 ? 999 + cols.findIndex(c => c.id === b.id) : bi);
    });
  } catch { return cols; }
};

export function useKanbanColumns() {
  const [columns, setColumns] = useState<KanbanColumn[]>(applyOrder(DEFAULT_COLUMNS));
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const columnsRef = useRef<KanbanColumn[]>(columns);
  columnsRef.current = columns;

  const refetch = useCallback(async () => {
    const overrides = loadColumnColorOverrides();
    const applyColor = (c: KanbanColumn): KanbanColumn =>
      overrides[c.id] ? { ...c, color: overrides[c.id] } : c;
    const { data: cols } = await supabase.from('kanban_columns').select('*').order('sort_order');
    let allCols: KanbanColumn[] = DEFAULT_COLUMNS;
    if (cols && cols.length) {
      const custom: KanbanColumn[] = cols.map((row: any) => ({
        id: `col-db-${row.id}`,
        db_id: row.id,
        title: row.title,
        status: row.status,
        color: row.color || DEFAULT_COLUMN_COLOR,
        is_default: false,
      }));
      allCols = applyOrder([...DEFAULT_COLUMNS, ...custom]).map(applyColor);
    } else {
      allCols = applyOrder(DEFAULT_COLUMNS).map(applyColor);
    }
    setColumns(allCols);

    const { data: placements } = await supabase.from('kanban_task_placements').select('*');
    const map: Record<string, string> = {};
    (placements || []).forEach((row: any) => {
      const col = allCols.find(c => c.db_id === row.column_id);
      if (col) map[row.task_id] = col.id;
    });
    setOverrides(map);
  }, []);

  useEffect(() => {
    refetch();
    const handler = () => refetch();
    window.addEventListener(KANBAN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(KANBAN_CHANGED_EVENT, handler);
  }, [refetch]);

  const getColumnForTask = useCallback((task: Task): KanbanColumn | undefined => {
    const overrideId = overrides[task.id];
    if (overrideId) {
      const col = columns.find(c => c.id === overrideId);
      if (col) return col;
    }
    return columns.find(c => c.status === task.status) || columns[0];
  }, [columns, overrides]);

  const moveTaskToColumn = useCallback(async (task: Task, column: KanbanColumn, userId?: string) => {
    if (column.db_id && !isBuiltIn(column.status)) {
      await supabase.from('kanban_task_placements').upsert({
        task_id: task.id,
        column_id: column.db_id,
        sort_order: 0,
      }, { onConflict: 'task_id' });
      setOverrides(prev => ({ ...prev, [task.id]: column.id }));
    } else {
      await supabase.from('kanban_task_placements').delete().eq('task_id', task.id);
      setOverrides(prev => {
        if (!prev[task.id]) return prev;
        const n = { ...prev };
        delete n[task.id];
        return n;
      });
      if (task.status !== column.status) {
        await supabase.from('tasks').update({ status: column.status as TaskStatus }).eq('id', task.id);
        // task_status_history is written automatically by a DB trigger
      }
    }
    window.dispatchEvent(new Event(KANBAN_CHANGED_EVENT));
  }, []);

  return { columns, overrides, getColumnForTask, moveTaskToColumn, refetch };
}

export const getColumnTitleI18n = (col: KanbanColumn, t: (k: string) => string) =>
  col.title.startsWith('status') ? t(col.title) : col.title;
