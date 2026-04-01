import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, MoreVertical, X, Check, Calendar, Trash2, Edit2, GripVertical, Palette, Filter } from 'lucide-react';
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

interface Column {
  id: string;
  title: string;
  status: string;
  color?: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  projects: Record<string, Project>;
  onTaskClick: (task: Task) => void;
  onTaskUpdate: () => void;
  selectedAssigneeIds?: string[];
}

const DEFAULT_COLUMN_COLOR = 'hsl(var(--muted))';

// Colors that work for both light and dark modes
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

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col-todo', title: 'statusTodo', status: 'todo', color: DEFAULT_COLUMN_COLOR },
  { id: 'col-in_progress', title: 'statusInProgress', status: 'in_progress', color: DEFAULT_COLUMN_COLOR },
  { id: 'col-review', title: 'statusReview', status: 'review', color: DEFAULT_COLUMN_COLOR },
  { id: 'col-done', title: 'statusDone', status: 'done', color: DEFAULT_COLUMN_COLOR },
];

export const KanbanBoard = ({ tasks, projects, onTaskClick, onTaskUpdate, selectedAssigneeIds: externalSelectedAssigneeIds }: KanbanBoardProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('kanban-columns-v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((col: Column) => ({
          ...col,
          color: col.color || DEFAULT_COLUMN_COLOR
        }));
      } catch {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });

  const [taskOrderMap, setTaskOrderMap] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('kanban-task-order-v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  // Assignee data & filter
  const [taskAssignees, setTaskAssignees] = useState<Record<string, Profile[]>>({});
  const [allAssignees, setAllAssignees] = useState<Profile[]>([]);
  const selectedAssigneeIds = externalSelectedAssigneeIds || [];

  const isDraggingRef = useRef(false);
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

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

  // Sync top scrollbar with main scrollbar
  useEffect(() => {
    const main = scrollContainerRef.current;
    const top = topScrollRef.current;
    if (!main || !top) return;
    
    let syncing = false;
    const syncFromMain = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = main.scrollLeft;
      syncing = false;
    };
    const syncFromTop = () => {
      if (syncing) return;
      syncing = true;
      main.scrollLeft = top.scrollLeft;
      syncing = false;
    };
    
    main.addEventListener('scroll', syncFromMain);
    top.addEventListener('scroll', syncFromTop);
    return () => {
      main.removeEventListener('scroll', syncFromMain);
      top.removeEventListener('scroll', syncFromTop);
    };
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

  // Persist columns
  useEffect(() => {
    localStorage.setItem('kanban-columns-v2', JSON.stringify(columns));
  }, [columns]);

  // Persist task order
  useEffect(() => {
    localStorage.setItem('kanban-task-order-v2', JSON.stringify(taskOrderMap));
  }, [taskOrderMap]);

  // Create a map of tasks by their status for quick lookup
  const filteredTasks = useMemo(() => {
    if (selectedAssigneeIds.length === 0) return tasks;
    return tasks.filter(task => {
      const assignees = taskAssignees[task.id];
      if (!assignees) return false;
      return assignees.some(a => selectedAssigneeIds.includes(a.user_id));
    });
  }, [tasks, selectedAssigneeIds, taskAssignees]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filteredTasks.forEach(task => {
      const status = task.status;
      if (!map[status]) {
        map[status] = [];
      }
      map[status].push(task);
    });
    return map;
  }, [filteredTasks]);

  // Automatically add new tasks to the beginning of saved orders
  useEffect(() => {
    const newOrderMap = { ...taskOrderMap };
    let updated = false;

    columns.forEach(column => {
      const columnTasks = tasksByStatus[column.status] || [];
      const currentOrder = newOrderMap[column.id] || [];
      
      // Find tasks not in the current order
      const newTasks = columnTasks.filter(task => !currentOrder.includes(task.id));
      
      if (newTasks.length > 0) {
        // Sort new tasks by created_at descending and prepend to order
        const sortedNewTaskIds = newTasks
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(t => t.id);
        
        newOrderMap[column.id] = [...sortedNewTaskIds, ...currentOrder];
        updated = true;
      }
    });

    if (updated) {
      setTaskOrderMap(newOrderMap);
    }
  }, [tasks, columns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get tasks for a column, sorted by saved order (new tasks at the beginning)
  const getTasksForColumn = useCallback((column: Column): Task[] => {
    const columnTasks = tasksByStatus[column.status] || [];
    const order = taskOrderMap[column.id];
    
    if (!order || order.length === 0) {
      // No saved order - sort by created_at descending (newest first)
      return [...columnTasks].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // Sort tasks by their position in the order array
    const sortedTasks = [...columnTasks].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      
      // If neither is in order, sort by created_at (newest first)
      if (indexA === -1 && indexB === -1) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // If only a is not in order, put it at the BEGINNING
      if (indexA === -1) return -1;
      // If only b is not in order, put it at the BEGINNING
      if (indexB === -1) return 1;
      
      return indexA - indexB;
    });

    return sortedTasks;
  }, [tasksByStatus, taskOrderMap]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = async (result: DropResult) => {
    // Reset drag flag after a short delay so onClick can check it
    setTimeout(() => { isDraggingRef.current = false; }, 0);
    const { destination, source, draggableId, type } = result;

    // No destination - dropped outside
    if (!destination) return;

    // Same position - no change needed
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Handle column reordering
    if (type === 'COLUMN') {
      setColumns(prevColumns => {
        const newColumns = [...prevColumns];
        const [movedColumn] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, movedColumn);
        return newColumns;
      });
      return;
    }

    // Handle task reordering
    const taskId = draggableId;
    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;

    const sourceColumn = columns.find(c => c.id === sourceColumnId);
    const destColumn = columns.find(c => c.id === destColumnId);

    if (!sourceColumn || !destColumn) return;

    // Get current tasks for both columns
    const sourceColumnTasks = getTasksForColumn(sourceColumn);
    const destColumnTasks = sourceColumnId === destColumnId 
      ? sourceColumnTasks 
      : getTasksForColumn(destColumn);

    if (sourceColumnId === destColumnId) {
      // Reordering within the same column
      const newOrder = sourceColumnTasks.map(t => t.id);
      const taskIndex = newOrder.indexOf(taskId);
      
      if (taskIndex !== -1) {
        newOrder.splice(taskIndex, 1);
      }
      newOrder.splice(destination.index, 0, taskId);

      setTaskOrderMap(prev => ({
        ...prev,
        [sourceColumnId]: newOrder
      }));
    } else {
      // Moving to a different column
      // Remove from source order
      const newSourceOrder = sourceColumnTasks
        .filter(t => t.id !== taskId)
        .map(t => t.id);

      // Add to destination order
      const newDestOrder = destColumnTasks
        .filter(t => t.id !== taskId)
        .map(t => t.id);
      newDestOrder.splice(destination.index, 0, taskId);

      // Update local state immediately
      setTaskOrderMap(prev => ({
        ...prev,
        [sourceColumnId]: newSourceOrder,
        [destColumnId]: newDestOrder
      }));

      // Update task status in database
      const newStatus = destColumn.status as TaskStatus;
      const oldStatus = sourceColumn.status;
      
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId);

        if (error) {
          console.error('Error updating task status:', error);
          // Revert on error
          onTaskUpdate();
        } else {
          // Record status change history
          if (user) {
            await supabase
              .from('task_status_history')
              .insert({
                task_id: taskId,
                old_status: oldStatus,
                new_status: newStatus,
                changed_by: user.id,
              });
          }
          // Refresh to sync with server
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

  const addColumn = () => {
    if (!newColumnName.trim()) return;
    
    const uniqueId = `col-custom-${Date.now()}`;
    const uniqueStatus = `custom_${Date.now()}`;
    
    const newColumn: Column = {
      id: uniqueId,
      title: newColumnName.trim(),
      status: uniqueStatus,
      color: getRandomColor(),
    };
    
    setColumns(prev => [...prev, newColumn]);
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const deleteColumn = (columnId: string) => {
    if (columns.length <= 1) return;
    setColumns(prev => prev.filter(c => c.id !== columnId));
    setTaskOrderMap(prev => {
      const newMap = { ...prev };
      delete newMap[columnId];
      return newMap;
    });
  };

  const startEditingColumn = (column: Column) => {
    setEditingColumn(column.id);
    setEditingName(column.title.startsWith('status') ? t(column.title) : column.title);
  };

  const saveColumnEdit = (columnId: string) => {
    if (!editingName.trim()) return;
    
    setColumns(prev => prev.map(c => 
      c.id === columnId ? { ...c, title: editingName.trim() } : c
    ));
    setEditingColumn(null);
    setEditingName('');
  };

  const setColumnColor = (columnId: string, color: string) => {
    setColumns(prev => prev.map(c =>
      c.id === columnId ? { ...c, color } : c
    ));
  };

  const getColumnTitle = (column: Column) => {
    if (column.title.startsWith('status')) {
      return t(column.title);
    }
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

      <div ref={scrollContainerRef} className="flex gap-4 min-h-[calc(100vh-320px)] pb-4 overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full scrollbar-thin" style={{ touchAction: 'pan-y', scrollbarWidth: 'thin' }}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-4"
            >
              {columns.map((column, columnIndex) => {
                const columnTasks = getTasksForColumn(column);
                
                return (
                  <Draggable 
                    key={column.id} 
                    draggableId={`column-${column.id}`} 
                    index={columnIndex}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "flex-shrink-0 w-80",
                          snapshot.isDragging && "opacity-90"
                        )}
                      >
                        <div
                          className="rounded-lg p-4 h-full flex flex-col border-2 border-border/50"
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
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8" 
                                  onClick={() => saveColumnEdit(column.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8" 
                                  onClick={() => setEditingColumn(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <h3 className="font-semibold text-foreground">
                                    {getColumnTitle(column)}
                                  </h3>
                                  <Badge variant="secondary" className="rounded-full bg-background">
                                    {columnTasks.length}
                                  </Badge>
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
                                    <DropdownMenuItem
                                      onClick={() => deleteColumn(column.id)}
                                      className="text-destructive"
                                    >
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
                                  <Draggable
                                    key={task.id}
                                    draggableId={task.id}
                                    index={taskIndex}
                                  >
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
                                        onClick={() => {
                                          if (!isDraggingRef.current) {
                                            onTaskClick(task);
                                          }
                                        }}
                                      >
                                        <CardContent className="p-3">
                                          <h4 className="font-medium text-foreground mb-1 line-clamp-2">
                                            {task.title}
                                          </h4>
                                          {task.project_id && projects[task.project_id] && (
                                            <Badge variant="outline" className="mb-2 text-xs">
                                              {projects[task.project_id].title}
                                            </Badge>
                                          )}
                                          {task.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                              {task.description}
                                            </p>
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
        <div className="flex-shrink-0 w-80 min-h-[150px]">
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingColumn(false);
                    setNewColumnName('');
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-12 border-dashed"
              onClick={() => setIsAddingColumn(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('addColumn')}
            </Button>
          )}
        </div>
      </div>
    </DragDropContext>
  );
};
