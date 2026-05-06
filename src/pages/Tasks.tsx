import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Calendar, List, BarChart3, Columns, Search, User, Filter, Repeat, GripVertical, Keyboard } from 'lucide-react';
import { Task, Project, Profile, Tag } from '@/types/database';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { TaskTemplatesDialog } from '@/components/tasks/TaskTemplatesDialog';
import { TasksExport } from '@/components/tasks/TasksExport';
import { GanttChart } from '@/components/tasks/GanttChart';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskFilters, TaskFiltersState, emptyFilters, hasActiveFilters } from '@/components/tasks/TaskFilters';
import { useTaskShortcuts } from '@/hooks/useTaskShortcuts';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useKanbanColumns, getColumnTitleI18n, KANBAN_CHANGED_EVENT, KanbanColumn } from '@/hooks/useKanbanColumns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

type SortOption = 'date_desc' | 'date_asc' | 'status' | 'name' | 'manual';

interface TaskTagJoin {
  tag_id: string;
  tags: Tag;
}

interface TaskAssignee {
  task_id: string;
  user_id: string;
  profiles: Profile;
}

const Tasks = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { columns, getColumnForTask, moveTaskToColumn, refetch: refetchKanban } = useKanbanColumns();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [creators, setCreators] = useState<Record<string, Profile>>({});
  const [taskTags, setTaskTags] = useState<Record<string, Tag[]>>({});
  const [taskAssignees, setTaskAssignees] = useState<Record<string, Profile[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('tasks-active-tab') || 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<TaskFiltersState>(emptyFilters);
  const [showShortcuts, setShowShortcuts] = useState(() => localStorage.getItem('tasks-hotkeys-seen') !== '1');
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const statusLabels: Record<string, string> = {
    todo: t('statusTodo'),
    in_progress: t('statusInProgress'),
    review: t('statusReview'),
    done: t('statusDone'),
  };

  const STATUS_COLORS: Record<string, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-crm-warning/10 text-crm-warning',
    review: 'bg-primary/10 text-primary',
    done: 'bg-crm-success/10 text-crm-success',
  };

  const STATUS_ORDER: Record<string, number> = {
    todo: 0,
    in_progress: 1,
    review: 2,
    done: 3,
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchCreators();
    fetchTaskTags();
    fetchTaskAssignees();
  }, []);

  // Refetch tasks when kanban placements change (cross-view sync)
  useEffect(() => {
    const handler = () => fetchTasks();
    window.addEventListener(KANBAN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(KANBAN_CHANGED_EVENT, handler);
  }, []);

  // Load manual order from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('tasks-manual-order');
    if (saved) {
      try { setManualOrder(JSON.parse(saved)); } catch {}
    }
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreators = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      const map: Record<string, Profile> = {};
      (data as Profile[]).forEach((p) => { map[p.user_id] = p; });
      setCreators(map);
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*');
    if (!error && data) {
      const map: Record<string, Project> = {};
      (data as unknown as Project[]).forEach((p) => { map[p.id] = p; });
      setProjects(map);
    }
  };

  const fetchTaskTags = async () => {
    const { data, error } = await supabase.from('task_tags').select('task_id, tag_id, tags(*)');
    if (!error && data) {
      const map: Record<string, Tag[]> = {};
      (data as unknown as (TaskTagJoin & { task_id: string })[]).forEach((item) => {
        if (!map[item.task_id]) map[item.task_id] = [];
        if (item.tags) map[item.task_id].push(item.tags);
      });
      setTaskTags(map);
    }
  };

  const fetchTaskAssignees = async () => {
    const { data, error } = await supabase.from('task_assignees').select('task_id, user_id, profiles(*)');
    if (!error && data) {
      const map: Record<string, Profile[]> = {};
      (data as unknown as TaskAssignee[]).forEach((item) => {
        if (!map[item.task_id]) map[item.task_id] = [];
        if (item.profiles) map[item.task_id].push(item.profiles);
      });
      setTaskAssignees(map);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleTaskClick = (task: Task) => navigate(`/tasks/${task.id}`);

  // Keyboard shortcuts
  const handleSwitchView = useCallback((view: string) => {
    setActiveTab(view);
    sessionStorage.setItem('tasks-active-tab', view);
  }, []);

  const toggleShortcuts = useCallback(() => {
    setShowShortcuts(prev => {
      if (prev) localStorage.setItem('tasks-hotkeys-seen', '1');
      return !prev;
    });
  }, []);

  useTaskShortcuts({
    onCreateTask: useCallback(() => setDialogOpen(true), []),
    onSwitchView: handleSwitchView,
    onToggleTemplates: useCallback(() => setTemplatesOpen(prev => !prev), []),
    onToggleHelp: toggleShortcuts,
  });

  // All unique tags for filter
  const allTags = useMemo(() => {
    const seen = new Map<string, Tag>();
    Object.values(taskTags).flat().forEach(tag => {
      if (!seen.has(tag.id)) seen.set(tag.id, tag);
    });
    return Array.from(seen.values());
  }, [taskTags]);

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks;

    // Apply filters
    if (filters.statuses.length > 0) {
      filtered = filtered.filter(t => filters.statuses.includes(t.status));
    }
    if (filters.projectIds.length > 0) {
      filtered = filtered.filter(t => t.project_id && filters.projectIds.includes(t.project_id));
    }
    if (filters.tagIds.length > 0) {
      filtered = filtered.filter(t => {
        const tags = taskTags[t.id];
        return tags?.some(tag => filters.tagIds.includes(tag.id));
      });
    }
    if (filters.deadlineFrom) {
      const from = filters.deadlineFrom.getTime();
      filtered = filtered.filter(t => t.deadline && new Date(t.deadline).getTime() >= from);
    }
    if (filters.deadlineTo) {
      const to = filters.deadlineTo.getTime() + 86400000; // include end day
      filtered = filtered.filter(t => t.deadline && new Date(t.deadline).getTime() < to);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => {
        if (task.title.toLowerCase().includes(query)) return true;
        if (task.description?.toLowerCase().includes(query)) return true;
        const statusLabel = statusLabels[task.status];
        if (statusLabel?.toLowerCase().includes(query)) return true;
        if (task.status.toLowerCase().includes(query)) return true;
        if (task.project_id && projects[task.project_id]?.title?.toLowerCase().includes(query)) return true;
        if (creators[task.created_by]?.name?.toLowerCase().includes(query)) return true;
        const assignees = taskAssignees[task.id];
        if (assignees?.some(a => a.name?.toLowerCase().includes(query))) return true;
        const tags = taskTags[task.id];
        if (tags?.some(tag => tag.name?.toLowerCase().includes(query))) return true;
        return false;
      });
    }

    // Sort
    if (sortBy === 'manual' && manualOrder.length > 0) {
      const orderMap = new Map(manualOrder.map((id, i) => [id, i]));
      return [...filtered].sort((a, b) => {
        const ai = orderMap.get(a.id) ?? 9999;
        const bi = orderMap.get(b.id) ?? 9999;
        return ai - bi;
      });
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'status': return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'name': return a.title.localeCompare(b.title);
        default: return 0;
      }
    });
  }, [tasks, searchQuery, sortBy, statusLabels, projects, creators, taskAssignees, taskTags, filters, manualOrder]);

  const allAssignees = useMemo(() => {
    const seen = new Map<string, Profile>();
    Object.values(taskAssignees).flat().forEach(p => {
      if (p.user_id && !seen.has(p.user_id)) seen.set(p.user_id, p);
    });
    return Array.from(seen.values());
  }, [taskAssignees]);

  const [isDragging, setIsDragging] = useState(false);

  // DnD handler
  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const items = Array.from(filteredAndSortedTasks);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const newOrder = items.map(t => t.id);
    setManualOrder(newOrder);
    if (sortBy !== 'manual') {
      setSortBy('manual');
      toast.success(t('manualSort') || 'Сортировка: вручную');
    }
    sessionStorage.setItem('tasks-manual-order', JSON.stringify(newOrder));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const shortcutHints = {
    ru: { title: 'Гарячие клавиши', hint: 'Нажмите клавишу на клавиатуре, когда курсор не находится в поле ввода' },
    en: { title: 'Hotkeys', hint: 'Press the key on your keyboard when the cursor is not focused on an input field' },
    uk: { title: 'Гарячі клавіші', hint: 'Натисніть клавішу на клавіатурі, коли курсор не у полі вводу' },
  }[language];

  const shortcutItems = [
    { key: 'N', desc: t('addTask') },
    { key: '1', desc: t('list') },
    { key: '2', desc: t('kanban') },
    { key: '3', desc: t('ganttChart') },
    { key: 'T', desc: t('recurringTasks') },
    { key: '?', desc: t('hotkeys') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('tasksTitle')}</h1>
          <p className="text-muted-foreground">{t('tasksDescription')}</p>
        </div>
        <div className="flex gap-2">
          <TasksExport tasks={filteredAndSortedTasks} projects={projects} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showShortcuts ? 'secondary' : 'outline'}
                size="icon"
                onClick={toggleShortcuts}
                aria-label={t('hotkeys')}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-1.5 text-xs">
                {t('hotkeys')}
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono border">?</kbd>
              </div>
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={() => setTemplatesOpen(true)} className="gap-2">
            <Repeat className="h-4 w-4" />
            {t('recurringTasks')}
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('addTask')}
          </Button>
        </div>
      </div>

      {/* Shortcuts hint bar */}
      {showShortcuts && (
        <Card className="animate-fade-in border-primary/30 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Keyboard className="h-4 w-4 text-primary" />
                {t('hotkeys')}:
              </div>
              {shortcutItems.map(s => (
                <div key={s.key} className="flex items-center gap-1.5 text-sm">
                  <kbd className="px-1.5 py-0.5 bg-background rounded text-xs font-mono border shadow-sm">{s.key}</kbd>
                  <span className="text-muted-foreground">{s.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pl-6">{shortcutHints.hint}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <TaskFilters
            filters={filters}
            onFiltersChange={setFilters}
            projects={projects}
            allTags={allTags}
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">{t('newest')}</SelectItem>
              <SelectItem value="date_asc">{t('oldest')}</SelectItem>
              <SelectItem value="status">{t('sortByStatus')}</SelectItem>
              <SelectItem value="name">{t('sortByName')}</SelectItem>
              <SelectItem value="manual">{t('manualSort') || 'Вручную'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters(filters) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">{t('activeFilters') || 'Фильтры'}:</span>
          {filters.statuses.map(s => (
            <Badge key={s} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, statuses: f.statuses.filter(v => v !== s) }))}>
              {statusLabels[s]} ×
            </Badge>
          ))}
          {filters.projectIds.map(id => (
            <Badge key={id} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, projectIds: f.projectIds.filter(v => v !== id) }))}>
              {projects[id]?.title} ×
            </Badge>
          ))}
          {filters.tagIds.map(id => {
            const tag = allTags.find(t => t.id === id);
            return tag ? (
              <Badge key={id} variant="secondary" className="gap-1 cursor-pointer" style={{ backgroundColor: `${tag.color}20`, color: tag.color }} onClick={() => setFilters(f => ({ ...f, tagIds: f.tagIds.filter(v => v !== id) }))}>
                {tag.name} ×
              </Badge>
            ) : null;
          })}
          {filters.deadlineFrom && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, deadlineFrom: undefined }))}>
              {t('from') || 'От'}: {format(filters.deadlineFrom, 'dd.MM.yy')} ×
            </Badge>
          )}
          {filters.deadlineTo && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, deadlineTo: undefined }))}>
              {t('to') || 'До'}: {format(filters.deadlineTo, 'dd.MM.yy')} ×
            </Badge>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); sessionStorage.setItem('tasks-active-tab', v); }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              {t('list')}
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2">
              <Columns className="h-4 w-4" />
              {t('kanban')}
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('ganttChart')}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'kanban' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {t('filterByAssignee')}
                  {selectedAssigneeIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {selectedAssigneeIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {allAssignees.map(assignee => (
                    <label key={assignee.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                      <Checkbox
                        checked={selectedAssigneeIds.includes(assignee.user_id)}
                        onCheckedChange={() => {
                          setSelectedAssigneeIds(prev =>
                            prev.includes(assignee.user_id)
                              ? prev.filter(id => id !== assignee.user_id)
                              : [...prev, assignee.user_id]
                          );
                        }}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={assignee.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: assignee.avatar_color || '#6366f1' }} className="text-[10px] text-white">
                          {getInitials(assignee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{assignee.name}</span>
                    </label>
                  ))}
                  {allAssignees.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">{t('noAssignees')}</p>
                  )}
                </div>
                {selectedAssigneeIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelectedAssigneeIds([])}>
                    {t('clearFilter')}
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <TabsContent value="list" className="mt-4">
          {filteredAndSortedTasks.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">{t('noTasks')}</h3>
                <p className="text-muted-foreground mb-4">{t('createFirstTask')}</p>
                <Button onClick={() => setDialogOpen(true)}>{t('createTask')}</Button>
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <Droppable droppableId="task-list">
                {(provided) => (
                  <div className="grid gap-4 min-w-0" ref={provided.innerRef} {...provided.droppableProps}>
                    {filteredAndSortedTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`cursor-pointer hover:shadow-md transition-shadow animate-slide-up min-w-0 max-w-full ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
                            style={{ ...provided.draggableProps.style, animationDelay: `${index * 0.03}s` }}
                            onClick={(e) => {
                              if (isDragging || snapshot.isDragging) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                              }
                              handleTaskClick(task);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4 min-w-0">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary hover:bg-muted/60 rounded p-1 -ml-1 shrink-0 transition-colors"
                                    onClick={e => e.stopPropagation()}
                                    title={t('manualSort') || 'Перетягивание'}
                                    aria-label="drag"
                                  >
                                    <GripVertical className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <h3 className="font-medium text-foreground truncate min-w-0">{task.title}</h3>
                                      {task.project_id && projects[task.project_id] && (
                                        <Badge variant="outline" className="shrink-0 max-w-[140px] truncate">
                                          {projects[task.project_id].title}
                                        </Badge>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{task.description}</p>
                                    )}
                                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
                                      {task.deadline && (
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                          <Calendar className="h-4 w-4" />
                                          {format(new Date(task.deadline), 'd MMM yyyy', { locale: dateLocale })}
                                        </div>
                                      )}
                                      {task.created_by && creators[task.created_by] && (
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
                                          <User className="h-4 w-4 shrink-0" />
                                          <span className="truncate">{t('createdBy')}: {creators[task.created_by].name}</span>
                                        </div>
                                      )}
                                    </div>
                                    {taskTags[task.id] && taskTags[task.id].length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {taskTags[task.id].map((tag) => (
                                          <Badge key={tag.id} variant="secondary" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }} className="text-xs border">
                                            {tag.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <Badge className={`${STATUS_COLORS[task.status]} whitespace-nowrap`}>{statusLabels[task.status]}</Badge>
                                  {taskAssignees[task.id] && taskAssignees[task.id].length > 0 && (
                                    <TooltipProvider>
                                      <div className="flex -space-x-2">
                                        {taskAssignees[task.id].slice(0, 3).map((assignee) => (
                                          <Tooltip key={assignee.user_id}>
                                            <TooltipTrigger asChild>
                                              <Avatar className="h-8 w-8 border-2 border-background">
                                                {assignee.avatar_url ? <AvatarImage src={assignee.avatar_url} alt={assignee.name} /> : null}
                                                <AvatarFallback style={{ backgroundColor: assignee.avatar_color || '#6366f1' }} className="text-white text-xs">
                                                  {getInitials(assignee.name)}
                                                </AvatarFallback>
                                              </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent><p>{assignee.name}</p></TooltipContent>
                                          </Tooltip>
                                        ))}
                                        {taskAssignees[task.id].length > 3 && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Avatar className="h-8 w-8 border-2 border-background">
                                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                                  +{taskAssignees[task.id].length - 3}
                                                </AvatarFallback>
                                              </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent><p>{taskAssignees[task.id].slice(3).map(a => a.name).join(', ')}</p></TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    </TooltipProvider>
                                  )}
                                </div>
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
            </DragDropContext>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="overflow-x-auto pb-4">
            <KanbanBoard
              tasks={filteredAndSortedTasks}
              projects={projects}
              onTaskClick={handleTaskClick}
              onTaskUpdate={fetchTasks}
              selectedAssigneeIds={selectedAssigneeIds}
            />
          </div>
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <GanttChart tasks={filteredAndSortedTasks} onTaskClick={handleTaskClick} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={fetchTasks} />
      <TaskTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} onTaskGenerated={fetchTasks} />
    </div>
  );
};

export default Tasks;
