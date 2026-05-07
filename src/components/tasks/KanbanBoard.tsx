import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, MoreVertical, X, Check, Calendar, Trash2, Edit2, GripVertical, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Task, TaskStatus, Project, Profile } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { KANBAN_CHANGED_EVENT } from '@/hooks/useKanbanColumns';
import { loadColumnColorOverrides, saveColumnColorOverride } from '@/lib/columnColors';

const notifyKanbanChange = () => window.dispatchEvent(new Event(KANBAN_CHANGED_EVENT));

interface Column {
  id: string;
  title: string;
  status: string;
  color?: string;
  is_default?: boolean;
  db_id?: string; // UUID from kanban_columns table (only for custom columns)
}

interface KanbanBoardProps {
  tasks: Task[];
  projects: Record<string, Project>;
  onTaskClick: (task: Task) => void;
  onTaskUpdate: () => void;
  selectedAssigneeIds?: string[];
}

const DEFAULT_COLUMN_COLOR = 'hsl(var(--muted))';

const COLUMN_COLORS = [
  { name: 'Default', value: 'hsl(var(--muted))' },
  { name: 'Blue', value: 'hsl(210 60% 85% / 0.5)' },
  { name: 'Green', value: 'hsl(142 50% 80% / 0.5)' },
  { name: 'Yellow', value: 'hsl(48 70% 80% / 0.5)' },
  { name: 'Orange', value: 'hsl(24 70% 80% / 0.5)' },
  { name: 'Purple', value: 'hsl(270 50% 80% / 0.5)' },
  { name: 'Pink', value: 'hsl(330 60% 80% / 0.5)' },
  { name: 'Red', value: 'hsl(0 60% 80% / 0.5)' },
];

const BUILT_IN_COLUMN_COLORS: Record<string, string> = {
  todo: 'hsl(220 14% 75% / 0.55)',
  in_progress: 'hsl(38 92% 70% / 0.55)',
  review: 'hsl(221 83% 70% / 0.55)',
  done: 'hsl(142 60% 65% / 0.55)',
};

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col-todo', title: 'statusTodo', status: 'todo', color: BUILT_IN_COLUMN_COLORS.todo, is_default: true },
  { id: 'col-in_progress', title: 'statusInProgress', status: 'in_progress', color: BUILT_IN_COLUMN_COLORS.in_progress, is_default: true },
  { id: 'col-review', title: 'statusReview', status: 'review', color: BUILT_IN_COLUMN_COLORS.review, is_default: true },
  { id: 'col-done', title: 'statusDone', status: 'done', color: BUILT_IN_COLUMN_COLORS.done, is_default: true },
];

const BUILT_IN_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

const isBuiltInStatus = (status: string): status is TaskStatus =>
  BUILT_IN_STATUSES.includes(status as TaskStatus);

export const KanbanBoard = ({ tasks, projects, onTaskClick, onTaskUpdate, selectedAssigneeIds: externalSelectedAssigneeIds }: KanbanBoardProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);

  const [columns, setColumnsState] = useState<Column[]>(DEFAULT_COLUMNS);

  const applyOrderFromStorage = (cols: Column[]): Column[] => {
    try {
      const saved = localStorage.getItem('kanban-column-order-v1');
      if (!saved) return cols;
      const order: string[] = JSON.parse(saved);
      const idx = (id: string) => {
        const i = order.indexOf(id);
        return i === -1 ? order.length + cols.findIndex(c => c.id === id) : i;
      };
      return [...cols].sort((a, b) => idx(a.id) - idx(b.id));
    } catch { return cols; }
  };

  const setColumns: typeof setColumnsState = (updater) => {
    setColumnsState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Column[]) => Column[])(prev) : updater;
      return next;
    });
  };
  const [taskOrderMap, setTaskOrderMap] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('kanban-task-order-v2');
    if (saved) { try { return JSON.parse(saved); } catch { return {}; } }
    return {};
  });
  const [taskColumnOverrides, setTaskColumnOverrides] = useState<Record<string, string>>({});
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [taskAssignees, setTaskAssignees] = useState<Record<string, Profile[]>>({});
  const [allAssignees, setAllAssignees] = useState<Profile[]>([]);
  const selectedAssigneeIds = externalSelectedAssigneeIds || [];

  const isDraggingRef = useRef(false);
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  // Load custom columns from DB
  useEffect(() => {
    const fetchColumns = async () => {
      const { data } = await supabase
        .from('kanban_columns')
        .select('*')
        .order('sort_order', { ascending: true });

      if (data && data.length > 0) {
        const customCols: Column[] = data.map((row: any) => ({
          id: `col-db-${row.id}`,
          db_id: row.id,
          title: row.title,
          status: row.status,
          color: row.color || DEFAULT_COLUMN_COLOR,
          is_default: false,
        }));
        setColumnsState(applyOrderFromStorage([...DEFAULT_COLUMNS, ...customCols]));
      } else {
        setColumnsState(applyOrderFromStorage(DEFAULT_COLUMNS));
      }
      setColumnsLoaded(true);
    };
    fetchColumns();
  }, []);

  // Load task placements from DB
  useEffect(() => {
    if (!columnsLoaded) return;
    const fetchPlacements = async () => {
      const { data } = await supabase
        .from('kanban_task_placements')
        .select('*');

      if (data && data.length > 0) {
        const overrides: Record<string, string> = {};
        data.forEach((row: any) => {
          const col = columns.find(c => c.db_id === row.column_id);
          if (col) {
            overrides[row.task_id] = col.id;
          }
        });
        setTaskColumnOverrides(overrides);
      }
    };
    fetchPlacements();
  }, [columnsLoaded, columns.length]);

  // Fetch assignees
  useEffect(() => {
    const fetchAssignees = async () => {
      const taskIds = tasks.map(t => t.id);
      if (taskIds.length === 0) {
        setTaskAssignees({});
        setAllAssignees([]);
        return;
      }
      const { data: assigneeRows } = await supabase
        .from('task_assignees')
        .select('task_id, user_id')
        .in('task_id', taskIds);
      if (!assigneeRows || assigneeRows.length === 0) {
        setTaskAssignees({});
        setAllAssignees([]);
        return;
      }
      const uniqueUserIds = [...new Set(assigneeRows.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('user_id, name, avatar_url, avatar_color')
        .in('user_id', uniqueUserIds);
      const profileMap = new Map<string, Profile>();
      (profiles || []).forEach(p => profileMap.set(p.user_id!, p as unknown as Profile));

      const map: Record<string, Profile[]> = {};
      assigneeRows.forEach(item => {
        if (!map[item.task_id]) map[item.task_id] = [];
        const profile = profileMap.get(item.user_id);
        if (profile) map[item.task_id].push(profile);
      });
      setTaskAssignees(map);
      setAllAssignees(Array.from(profileMap.values()));
    };
    fetchAssignees();
  }, [tasks]);

  // Sync top scrollbar
  useEffect(() => {
    const main = scrollContainerRef.current;
    const top = topScrollRef.current;
    if (!main || !top) return;
    let syncing = false;
    const syncFromMain = () => { if (syncing) return; syncing = true; top.scrollLeft = main.scrollLeft; syncing = false; };
    const syncFromTop = () => { if (syncing) return; syncing = true; main.scrollLeft = top.scrollLeft; syncing = false; };
    main.addEventListener('scroll', syncFromMain);
    top.addEventListener('scroll', syncFromTop);
    return () => { main.removeEventListener('scroll', syncFromMain); top.removeEventListener('scroll', syncFromTop); };
  }, []);

  // Update top scroll width
  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current && topScrollRef.current) {
        const inner = scrollContainerRef.current.scrollWidth;
        const spacer = topScrollRef.current.firstElementChild as HTMLDivElement;
        if (spacer) spacer.style.width = `${inner}px`;
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (scrollContainerRef.current) observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, [columns]);

  // Persist task order locally
  useEffect(() => {
    localStorage.setItem('kanban-task-order-v2', JSON.stringify(taskOrderMap));
  }, [taskOrderMap]);

  // Remove invalid overrides
  useEffect(() => {
    const validTaskIds = new Set(tasks.map(task => task.id));
    const validColumnIds = new Set(columns.map(column => column.id));
    setTaskColumnOverrides(prev => {
      let changed = false;
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([taskId, columnId]) => {
        if (validTaskIds.has(taskId) && validColumnIds.has(columnId)) {
          next[taskId] = columnId;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tasks, columns]);

  const filteredTasks = useMemo(() => {
    if (selectedAssigneeIds.length === 0) return tasks;
    return tasks.filter(task => {
      const assignees = taskAssignees[task.id];
      if (!assignees) return false;
      return assignees.some(a => selectedAssigneeIds.includes(a.user_id));
    });
  }, [tasks, selectedAssigneeIds, taskAssignees]);

  const getBaseTasksForColumn = useCallback((column: Column): Task[] => {
    return filteredTasks.filter(task => {
      const overriddenColumnId = taskColumnOverrides[task.id];
      if (overriddenColumnId) return overriddenColumnId === column.id;
      return task.status === column.status;
    });
  }, [filteredTasks, taskColumnOverrides]);

  // Auto-add new tasks to order
  useEffect(() => {
    setTaskOrderMap(prev => {
      const next = { ...prev };
      const validColumnIds = new Set(columns.map(column => column.id));
      let updated = false;
      Object.keys(next).forEach(columnId => {
        if (!validColumnIds.has(columnId)) { delete next[columnId]; updated = true; }
      });
      columns.forEach(column => {
        const columnTasks = getBaseTasksForColumn(column);
        const currentOrder = next[column.id] || [];
        const columnTaskIds = new Set(columnTasks.map(task => task.id));
        const sanitizedOrder = currentOrder.filter(taskId => columnTaskIds.has(taskId));
        if (sanitizedOrder.length !== currentOrder.length) { next[column.id] = sanitizedOrder; updated = true; }
        const newTasks = columnTasks.filter(task => !sanitizedOrder.includes(task.id));
        if (newTasks.length > 0) {
          const sortedNewTaskIds = newTasks
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(task => task.id);
          next[column.id] = [...sortedNewTaskIds, ...sanitizedOrder];
          updated = true;
        }
      });
      return updated ? next : prev;
    });
  }, [columns, getBaseTasksForColumn]);

  const getTasksForColumn = useCallback((column: Column): Task[] => {
    const columnTasks = getBaseTasksForColumn(column);
    const order = taskOrderMap[column.id];
    if (!order || order.length === 0) {
      return [...columnTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return [...columnTasks].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (indexA === -1) return -1;
      if (indexB === -1) return 1;
      return indexA - indexB;
    });
  }, [getBaseTasksForColumn, taskOrderMap]);

  const handleDragStart = () => { isDraggingRef.current = true; };

  const handleDragEnd = async (result: DropResult) => {
    setTimeout(() => { isDraggingRef.current = false; }, 0);
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'COLUMN') {
      setColumns(prevColumns => {
        const newColumns = [...prevColumns];
        const [movedColumn] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, movedColumn);
        // Persist full column order locally so it survives reloads
        try {
          localStorage.setItem('kanban-column-order-v1', JSON.stringify(newColumns.map(c => c.id)));
        } catch {}
        // Update sort_order for custom columns in DB
        const customCols = newColumns.filter(c => c.db_id);
        customCols.forEach((col, idx) => {
          supabase.from('kanban_columns').update({ sort_order: idx }).eq('id', col.db_id!).then(() => {});
        });
        return newColumns;
      });
      return;
    }

    const taskId = draggableId;
    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;
    const sourceColumn = columns.find(c => c.id === sourceColumnId);
    const destColumn = columns.find(c => c.id === destColumnId);
    const movedTask = tasks.find(task => task.id === taskId);
    if (!sourceColumn || !destColumn || !movedTask) return;

    const sourceColumnTasks = getTasksForColumn(sourceColumn);
    const destColumnTasks = sourceColumnId === destColumnId ? sourceColumnTasks : getTasksForColumn(destColumn);

    if (sourceColumnId === destColumnId) {
      const newOrder = sourceColumnTasks.map(t => t.id);
      const taskIndex = newOrder.indexOf(taskId);
      if (taskIndex !== -1) newOrder.splice(taskIndex, 1);
      newOrder.splice(destination.index, 0, taskId);
      setTaskOrderMap(prev => ({ ...prev, [sourceColumnId]: newOrder }));
    } else {
      const newSourceOrder = sourceColumnTasks.filter(t => t.id !== taskId).map(t => t.id);
      const newDestOrder = destColumnTasks.filter(t => t.id !== taskId).map(t => t.id);
      newDestOrder.splice(destination.index, 0, taskId);
      setTaskOrderMap(prev => ({ ...prev, [sourceColumnId]: newSourceOrder, [destColumnId]: newDestOrder }));

      if (!isBuiltInStatus(destColumn.status)) {
        // Moving to a custom column — save placement in DB
        setTaskColumnOverrides(prev => ({ ...prev, [taskId]: destColumnId }));
        if (destColumn.db_id) {
          await supabase.from('kanban_task_placements').upsert({
            task_id: taskId,
            column_id: destColumn.db_id,
            sort_order: destination.index,
          }, { onConflict: 'task_id' });
        }
        notifyKanbanChange();
        return;
      }

      // Moving to a built-in column — remove placement
      setTaskColumnOverrides(prev => {
        if (!prev[taskId]) return prev;
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      // Remove from DB placements
      await supabase.from('kanban_task_placements').delete().eq('task_id', taskId);

      if (movedTask.status === destColumn.status) {
        notifyKanbanChange();
        return;
      }

      const newStatus = destColumn.status as TaskStatus;
      const oldStatus = movedTask.status;
      try {
        const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
        if (error) {
          console.error('Error updating task status:', error);
          onTaskUpdate();
        } else {
          if (user) {
            await supabase.from('task_status_history').insert({
              task_id: taskId, old_status: oldStatus, new_status: newStatus, changed_by: user.id,
            });
          }
          notifyKanbanChange();
          onTaskUpdate();
        }
      } catch (error) {
        console.error('Error updating task:', error);
        onTaskUpdate();
      }
    }
  };

  const getRandomColor = () => {
    const colorOptions = COLUMN_COLORS.slice(1);
    return colorOptions[Math.floor(Math.random() * colorOptions.length)].value;
  };

  const addColumn = async () => {
    if (!newColumnName.trim() || !user) return;
    const uniqueStatus = `custom_${Date.now()}`;
    const color = getRandomColor();
    const sortOrder = columns.filter(c => c.db_id).length;

    const { data, error } = await supabase.from('kanban_columns').insert({
      title: newColumnName.trim(),
      status: uniqueStatus,
      color,
      sort_order: sortOrder,
      is_default: false,
      created_by: user.id,
    }).select().single();

    if (!error && data) {
      const newColumn: Column = {
        id: `col-db-${data.id}`,
        db_id: data.id,
        title: data.title,
        status: data.status,
        color: data.color || DEFAULT_COLUMN_COLOR,
        is_default: false,
      };
      setColumns(prev => [...prev, newColumn]);
    }
    setNewColumnName('');
    setIsAddingColumn(false);
    notifyKanbanChange();
  };

  const deleteColumn = async (columnId: string) => {
    if (columns.length <= 1) return;
    const column = columns.find(c => c.id === columnId);
    if (column?.db_id) {
      await supabase.from('kanban_columns').delete().eq('id', column.db_id);
    }
    setColumns(prev => prev.filter(c => c.id !== columnId));
    setTaskOrderMap(prev => { const m = { ...prev }; delete m[columnId]; return m; });
    setTaskColumnOverrides(prev => {
      let changed = false;
      const next = { ...prev };
      Object.entries(next).forEach(([taskId, targetColumnId]) => {
        if (targetColumnId === columnId) { delete next[taskId]; changed = true; }
      });
      return changed ? next : prev;
    });
    notifyKanbanChange();
  };

  const startEditingColumn = (column: Column) => {
    setEditingColumn(column.id);
    setEditingName(column.title.startsWith('status') ? t(column.title) : column.title);
  };

  const saveColumnEdit = async (columnId: string) => {
    if (!editingName.trim()) return;
    const column = columns.find(c => c.id === columnId);
    if (column?.db_id) {
      await supabase.from('kanban_columns').update({ title: editingName.trim() }).eq('id', column.db_id);
    }
    setColumns(prev => prev.map(c => c.id === columnId ? { ...c, title: editingName.trim() } : c));
    setEditingColumn(null);
    setEditingName('');
    notifyKanbanChange();
  };

  const setColumnColor = async (columnId: string, color: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column?.db_id) {
      await supabase.from('kanban_columns').update({ color }).eq('id', column.db_id);
    }
    setColumns(prev => prev.map(c => c.id === columnId ? { ...c, color } : c));
    notifyKanbanChange();
  };

  const getColumnTitle = (column: Column) => {
    if (column.title.startsWith('status')) return t(column.title);
    return column.title;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div style={{ height: '1px' }} />
      </div>

      <div ref={scrollContainerRef} className="flex gap-3 sm:gap-4 min-h-[calc(100vh-320px)] pb-4 overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full scrollbar-thin overscroll-x-contain" style={{ touchAction: 'pan-y pan-x', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-3 sm:gap-4">
              {columns.map((column, columnIndex) => {
                const columnTasks = getTasksForColumn(column);
                return (
                  <Draggable key={column.id} draggableId={`column-${column.id}`} index={columnIndex}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn("flex-shrink-0 w-[280px] sm:w-80", snapshot.isDragging && "opacity-90")}
                      >
                        <div
                          className="rounded-lg p-3 sm:p-4 h-full flex flex-col border-2 border-border/50"
                          style={{ backgroundColor: column.color || DEFAULT_COLUMN_COLOR }}
                        >
                          {/* Column Header */}
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing"
                          >
                            {editingColumn === column.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveColumnEdit(column.id)}
                                  className="h-8 bg-background"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveColumnEdit(column.id)}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingColumn(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <h3 className="font-semibold text-foreground">{getColumnTitle(column)}</h3>
                                  <Badge variant="secondary" className="rounded-full bg-background">{columnTasks.length}</Badge>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => startEditingColumn(column)}>
                                      <Edit2 className="h-4 w-4 mr-2" />
                                      {t('editColumn')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <div className="px-2 py-1.5">
                                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <Palette className="h-3 w-3" />
                                        {t('columnColor') || 'Цвет колонки'}
                                      </p>
                                      <div className="grid grid-cols-4 gap-1">
                                        {COLUMN_COLORS.map((colorOption) => (
                                          <button
                                            key={colorOption.value}
                                            className={cn(
                                              "w-6 h-6 rounded border-2 transition-all",
                                              column.color === colorOption.value
                                                ? "border-primary ring-2 ring-primary/20"
                                                : "border-border hover:border-primary/50"
                                            )}
                                            style={{ backgroundColor: colorOption.value }}
                                            onClick={() => setColumnColor(column.id, colorOption.value)}
                                            title={colorOption.name}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => deleteColumn(column.id)} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t('deleteColumn')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                          </div>

                          {/* Tasks Droppable */}
                          <Droppable droppableId={column.id} type="TASK">
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  'flex-1 space-y-2 transition-colors rounded-lg p-2 min-h-[150px]',
                                  snapshot.isDraggingOver && 'bg-primary/10 ring-2 ring-primary/30 ring-dashed'
                                )}
                              >
                                {columnTasks.map((task, taskIndex) => (
                                  <Draggable key={task.id} draggableId={task.id} index={taskIndex}>
                                    {(provided, snapshot) => (
                                      <Card
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={cn(
                                          'cursor-pointer hover:shadow-md transition-shadow bg-background',
                                          snapshot.isDragging && 'shadow-lg rotate-2'
                                        )}
                                        style={{
                                          ...provided.draggableProps.style,
                                          borderLeftColor: task.color || '#3b82f6',
                                          borderLeftWidth: '4px',
                                        }}
                                        onClick={() => { if (!isDraggingRef.current) onTaskClick(task); }}
                                      >
                                        <CardContent className="p-3">
                                          <h4 className="font-medium text-foreground mb-1 line-clamp-2">{task.title}</h4>
                                          {task.project_id && projects[task.project_id] && (
                                            <Badge variant="outline" className="mb-2 text-xs">{projects[task.project_id].title}</Badge>
                                          )}
                                          {task.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                                          )}
                                          <div className="flex items-center justify-between mt-1">
                                            {task.deadline && (
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(task.deadline), 'd MMM', { locale: dateLocale })}
                                              </div>
                                            )}
                                            {taskAssignees[task.id] && taskAssignees[task.id].length > 0 && (
                                              <TooltipProvider>
                                                <div className="flex -space-x-1.5 ml-auto">
                                                  {taskAssignees[task.id].slice(0, 2).map((assignee) => (
                                                    <Tooltip key={assignee.user_id}>
                                                      <TooltipTrigger asChild>
                                                        <Avatar className="h-5 w-5 border border-background">
                                                          <AvatarImage src={assignee.avatar_url || undefined} />
                                                          <AvatarFallback
                                                            style={{ backgroundColor: assignee.avatar_color || '#6366f1' }}
                                                            className="text-[8px] text-white"
                                                          >
                                                            {getInitials(assignee.name)}
                                                          </AvatarFallback>
                                                        </Avatar>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>{assignee.name}</p></TooltipContent>
                                                    </Tooltip>
                                                  ))}
                                                  {taskAssignees[task.id].length > 2 && (
                                                    <Avatar className="h-5 w-5 border border-background">
                                                      <AvatarFallback className="bg-muted text-muted-foreground text-[8px]">
                                                        +{taskAssignees[task.id].length - 2}
                                                      </AvatarFallback>
                                                    </Avatar>
                                                  )}
                                                </div>
                                              </TooltipProvider>
                                            )}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Add Column Button */}
        <div className="flex-shrink-0 w-[280px] sm:w-80 min-h-[150px]">
          {isAddingColumn ? (
            <div className="bg-muted/50 rounded-lg p-4 border-2 border-dashed border-border">
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder={t('columnName')}
                onKeyDown={(e) => e.key === 'Enter' && addColumn()}
                autoFocus
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addColumn} disabled={!newColumnName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('add')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsAddingColumn(false); setNewColumnName(''); }}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full h-12 border-dashed" onClick={() => setIsAddingColumn(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addColumn')}
            </Button>
          )}
        </div>
      </div>
    </DragDropContext>
  );
};
