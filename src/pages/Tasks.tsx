import { useEffect, useState, useMemo } from 'react';
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
import { Plus, Calendar, List, BarChart3, Columns, Search, User } from 'lucide-react';
import { Task, Project, Profile, Tag } from '@/types/database';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { GanttChart } from '@/components/tasks/GanttChart';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

type SortOption = 'date_desc' | 'date_asc' | 'status' | 'name';

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
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [creators, setCreators] = useState<Record<string, Profile>>({});
  const [taskTags, setTaskTags] = useState<Record<string, Tag[]>>({});
  const [taskAssignees, setTaskAssignees] = useState<Record<string, Profile[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

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
      (data as Profile[]).forEach((p) => {
        map[p.user_id] = p;
      });
      setCreators(map);
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*');
    if (!error && data) {
      const map: Record<string, Project> = {};
      (data as unknown as Project[]).forEach((p) => {
        map[p.id] = p;
      });
      setProjects(map);
    }
  };

  const fetchTaskTags = async () => {
    const { data, error } = await supabase
      .from('task_tags')
      .select('task_id, tag_id, tags(*)');
    
    if (!error && data) {
      const map: Record<string, Tag[]> = {};
      (data as unknown as (TaskTagJoin & { task_id: string })[]).forEach((item) => {
        if (!map[item.task_id]) {
          map[item.task_id] = [];
        }
        if (item.tags) {
          map[item.task_id].push(item.tags);
        }
      });
      setTaskTags(map);
    }
  };

  const fetchTaskAssignees = async () => {
    const { data, error } = await supabase
      .from('task_assignees')
      .select('task_id, user_id, profiles(*)');
    
    if (!error && data) {
      const map: Record<string, Profile[]> = {};
      (data as unknown as TaskAssignee[]).forEach((item) => {
        if (!map[item.task_id]) {
          map[item.task_id] = [];
        }
        if (item.profiles) {
          map[item.task_id].push(item.profiles);
        }
      });
      setTaskAssignees(map);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
  };

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort tasks
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [tasks, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('tasksTitle')}</h1>
          <p className="text-muted-foreground">{t('tasksDescription')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addTask')}
        </Button>
      </div>

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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('sortBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">{t('newest')}</SelectItem>
            <SelectItem value="date_asc">{t('oldest')}</SelectItem>
            <SelectItem value="status">{t('sortByStatus')}</SelectItem>
            <SelectItem value="name">{t('sortByName')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            <div className="grid gap-4">
              {filteredAndSortedTasks.map((task, index) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow animate-slide-up"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => handleTaskClick(task)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{task.title}</h3>
                          {task.project_id && projects[task.project_id] && (
                            <Badge variant="outline" className="shrink-0">
                              {projects[task.project_id].title}
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          {task.deadline && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(task.deadline), 'd MMM yyyy', { locale: dateLocale })}
                            </div>
                          )}
                          {task.created_by && creators[task.created_by] && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>{t('createdBy')}: {creators[task.created_by].name}</span>
                            </div>
                          )}
                        </div>
                        {/* Tags */}
                        {taskTags[task.id] && taskTags[task.id].length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {taskTags[task.id].map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }}
                                className="text-xs border"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={STATUS_COLORS[task.status]}>
                          {statusLabels[task.status]}
                        </Badge>
                        {/* Assignees */}
                        {taskAssignees[task.id] && taskAssignees[task.id].length > 0 && (
                          <TooltipProvider>
                            <div className="flex -space-x-2">
                              {taskAssignees[task.id].slice(0, 3).map((assignee) => (
                                <Tooltip key={assignee.user_id}>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-8 w-8 border-2 border-background">
                                      {assignee.avatar_url ? (
                                        <AvatarImage src={assignee.avatar_url} alt={assignee.name} />
                                      ) : null}
                                      <AvatarFallback 
                                        style={{ backgroundColor: assignee.avatar_color || '#6366f1' }}
                                        className="text-white text-xs"
                                      >
                                        {getInitials(assignee.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{assignee.name}</p>
                                  </TooltipContent>
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
                                  <TooltipContent>
                                    <p>{taskAssignees[task.id].slice(3).map(a => a.name).join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="overflow-x-auto pb-4">
            <KanbanBoard 
              tasks={filteredAndSortedTasks} 
              projects={projects} 
              onTaskClick={handleTaskClick}
              onTaskUpdate={fetchTasks}
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

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchTasks}
      />
    </div>
  );
};

export default Tasks;
