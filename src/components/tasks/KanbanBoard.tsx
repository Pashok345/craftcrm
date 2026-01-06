import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreVertical, X, Check, Calendar, Trash2, Edit2, GripVertical, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Task, TaskStatus, Project } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Column {
  id: string;
  title: string;
  status: TaskStatus;
  color?: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  projects: Record<string, Project>;
  onTaskClick: (task: Task) => void;
  onTaskUpdate: () => void;
}

const DEFAULT_COLUMN_COLOR = 'hsl(var(--muted))';

const COLUMN_COLORS = [
  { name: 'Default', value: 'hsl(var(--muted))' },
  { name: 'Blue', value: 'hsl(210, 100%, 95%)' },
  { name: 'Green', value: 'hsl(142, 76%, 93%)' },
  { name: 'Yellow', value: 'hsl(48, 100%, 93%)' },
  { name: 'Orange', value: 'hsl(24, 100%, 93%)' },
  { name: 'Purple', value: 'hsl(270, 76%, 95%)' },
  { name: 'Pink', value: 'hsl(330, 80%, 95%)' },
  { name: 'Red', value: 'hsl(0, 76%, 95%)' },
];

const DEFAULT_COLUMNS: Column[] = [
  { id: 'todo', title: 'statusTodo', status: 'todo', color: DEFAULT_COLUMN_COLOR },
  { id: 'in_progress', title: 'statusInProgress', status: 'in_progress', color: DEFAULT_COLUMN_COLOR },
  { id: 'review', title: 'statusReview', status: 'review', color: DEFAULT_COLUMN_COLOR },
  { id: 'done', title: 'statusDone', status: 'done', color: DEFAULT_COLUMN_COLOR },
];

export const KanbanBoard = ({ tasks, projects, onTaskClick, onTaskUpdate }: KanbanBoardProps) => {
  const { t, language } = useLanguage();
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('kanban-columns');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure all columns have color property
      return parsed.map((col: Column) => ({
        ...col,
        color: col.color || DEFAULT_COLUMN_COLOR
      }));
    }
    return DEFAULT_COLUMNS;
  });
  const [taskOrder, setTaskOrder] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('kanban-task-order');
    return saved ? JSON.parse(saved) : {};
  });
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    localStorage.setItem('kanban-columns', JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    localStorage.setItem('kanban-task-order', JSON.stringify(taskOrder));
  }, [taskOrder]);

  const getTasksForColumn = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return [];
    const columnTasks = tasks.filter(task => task.status === column.status);
    
    const order = taskOrder[columnId];
    if (order) {
      return columnTasks.sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    return columnTasks;
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Handle column reordering
    if (type === 'COLUMN') {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);
      setColumns(newColumns);
      return;
    }

    // Handle task reordering
    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    const destColumn = columns.find(c => c.id === destination.droppableId);
    const sourceColumn = columns.find(c => c.id === source.droppableId);
    if (!destColumn || !sourceColumn) return;

    // If moving within the same column, just update order
    if (source.droppableId === destination.droppableId) {
      const columnTasks = getTasksForColumn(source.droppableId);
      const newOrder = columnTasks.map(t => t.id);
      const [removed] = newOrder.splice(source.index, 1);
      newOrder.splice(destination.index, 0, removed);
      
      setTaskOrder(prev => ({
        ...prev,
        [source.droppableId]: newOrder
      }));
      return;
    }

    // Moving to a different column - update status
    const { error } = await supabase
      .from('tasks')
      .update({ status: destColumn.status })
      .eq('id', task.id);

    if (!error) {
      // Update order in destination column
      const destTasks = getTasksForColumn(destination.droppableId);
      const newDestOrder = destTasks.map(t => t.id);
      newDestOrder.splice(destination.index, 0, task.id);
      
      // Remove from source column order
      const sourceTasks = getTasksForColumn(source.droppableId);
      const newSourceOrder = sourceTasks.filter(t => t.id !== task.id).map(t => t.id);
      
      setTaskOrder(prev => ({
        ...prev,
        [source.droppableId]: newSourceOrder,
        [destination.droppableId]: newDestOrder
      }));
      
      onTaskUpdate();
    }
  };

  const addColumn = () => {
    if (!newColumnName.trim()) return;
    
    // Generate a unique custom status that doesn't match existing task statuses
    const uniqueStatus = `custom_status_${Date.now()}` as TaskStatus;
    
    const newColumn: Column = {
      id: `custom_${Date.now()}`,
      title: newColumnName.trim(),
      status: uniqueStatus,
      color: DEFAULT_COLUMN_COLOR,
    };
    
    setColumns([...columns, newColumn]);
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const deleteColumn = (columnId: string) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter(c => c.id !== columnId));
  };

  const startEditingColumn = (column: Column) => {
    setEditingColumn(column.id);
    setEditingName(column.title.startsWith('status') ? t(column.title) : column.title);
  };

  const saveColumnEdit = (columnId: string) => {
    if (!editingName.trim()) return;
    
    setColumns(columns.map(c => 
      c.id === columnId ? { ...c, title: editingName.trim() } : c
    ));
    setEditingColumn(null);
    setEditingName('');
  };

  const setColumnColor = (columnId: string, color: string) => {
    setColumns(columns.map(c =>
      c.id === columnId ? { ...c, color } : c
    ));
  };

  const getColumnTitle = (column: Column) => {
    if (column.title.startsWith('status')) {
      return t(column.title);
    }
    return column.title;
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="columns" direction="horizontal" type="COLUMN">
        {(provided) => (
          <div 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex gap-4 min-h-[calc(100vh-280px)]"
          >
            {columns.map((column, columnIndex) => (
              <Draggable key={column.id} draggableId={`column-${column.id}`} index={columnIndex}>
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
                              <Badge variant="secondary" className="rounded-full bg-background">
                                {getTasksForColumn(column.id).length}
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

                      {/* Tasks */}
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
                            {getTasksForColumn(column.id).map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
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
                                    onClick={() => onTaskClick(task)}
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
                                      {task.deadline && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Calendar className="h-3 w-3" />
                                          {format(new Date(task.deadline), 'd MMM', { locale: dateLocale })}
                                        </div>
                                      )}
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
            ))}
            {provided.placeholder}

            {/* Add Column */}
            <div className="flex-shrink-0 w-80">
              {isAddingColumn ? (
                <div className="bg-muted/50 rounded-lg p-4 border-2 border-dashed border-border">
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder={t('columnName')}
                    onKeyDown={(e) => e.key === 'Enter' && addColumn()}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={addColumn}>
                      {t('saveColumn')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setIsAddingColumn(false);
                      setNewColumnName('');
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-12 border-dashed border-2"
                  onClick={() => setIsAddingColumn(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addColumn')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
