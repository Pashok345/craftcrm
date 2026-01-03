import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreVertical, X, Check, Calendar, Trash2, Edit2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Task, TaskStatus, Project } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Column {
  id: string;
  title: string;
  status: TaskStatus;
}

interface KanbanBoardProps {
  tasks: Task[];
  projects: Record<string, Project>;
  onTaskClick: (task: Task) => void;
  onTaskUpdate: () => void;
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'todo', title: 'statusTodo', status: 'todo' },
  { id: 'in_progress', title: 'statusInProgress', status: 'in_progress' },
  { id: 'review', title: 'statusReview', status: 'review' },
  { id: 'done', title: 'statusDone', status: 'done' },
];

export const KanbanBoard = ({ tasks, projects, onTaskClick, onTaskUpdate }: KanbanBoardProps) => {
  const { t, language } = useLanguage();
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('kanban-columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    localStorage.setItem('kanban-columns', JSON.stringify(columns));
  }, [columns]);

  const getTasksForColumn = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return [];
    return tasks.filter(task => task.status === column.status);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    const destColumn = columns.find(c => c.id === destination.droppableId);
    if (!destColumn) return;

    // Update task status in database
    const { error } = await supabase
      .from('tasks')
      .update({ status: destColumn.status })
      .eq('id', task.id);

    if (!error) {
      onTaskUpdate();
    }
  };

  const addColumn = () => {
    if (!newColumnName.trim()) return;
    
    const newColumn: Column = {
      id: `custom_${Date.now()}`,
      title: newColumnName.trim(),
      status: 'todo' as TaskStatus, // Default status for custom columns
    };
    
    setColumns([...columns, newColumn]);
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const deleteColumn = (columnId: string) => {
    // Don't delete if it's the last column or a default column
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

  const getColumnTitle = (column: Column) => {
    if (column.title.startsWith('status')) {
      return t(column.title);
    }
    return column.title;
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-80">
            <div className="bg-muted/50 rounded-lg p-4">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                {editingColumn === column.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveColumnEdit(column.id)}
                      className="h-8"
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
                      <h3 className="font-semibold text-foreground">{getColumnTitle(column)}</h3>
                      <Badge variant="secondary" className="rounded-full">
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
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'min-h-[200px] space-y-2 transition-colors rounded-lg p-1',
                      snapshot.isDraggingOver && 'bg-primary/5'
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
                              'cursor-pointer hover:shadow-md transition-shadow',
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
        ))}

        {/* Add Column */}
        <div className="flex-shrink-0 w-80">
          {isAddingColumn ? (
            <div className="bg-muted/50 rounded-lg p-4">
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
