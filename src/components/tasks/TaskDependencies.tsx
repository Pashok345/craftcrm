import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Link2, ArrowRight, Lock } from 'lucide-react';
import { Task } from '@/types/database';

interface Dependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  created_by: string;
}

interface Props {
  taskId: string;
  onUpdate?: () => void;
}

export const TaskDependencies = ({ taskId, onUpdate }: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, Task>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [depType, setDepType] = useState('blocked_by');

  useEffect(() => {
    fetchDependencies();
    fetchAllTasks();
  }, [taskId]);

  const fetchDependencies = async () => {
    const { data } = await supabase
      .from('task_dependencies')
      .select('*')
      .or(`task_id.eq.${taskId},depends_on_task_id.eq.${taskId}`);
    setDependencies((data as Dependency[]) || []);
  };

  const fetchAllTasks = async () => {
    const { data } = await supabase.from('tasks').select('id, title, status').neq('id', taskId);
    const tasks = (data as Task[]) || [];
    setAllTasks(tasks);
    const map: Record<string, Task> = {};
    tasks.forEach(t => { map[t.id] = t; });
    setTaskMap(map);
  };

  const handleAdd = async () => {
    if (!selectedTaskId || !user) return;

    const insertData = depType === 'blocked_by'
      ? { task_id: taskId, depends_on_task_id: selectedTaskId, dependency_type: 'blocks', created_by: user.id }
      : { task_id: selectedTaskId, depends_on_task_id: taskId, dependency_type: 'blocks', created_by: user.id };

    const { error } = await supabase.from('task_dependencies').insert(insertData);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('dependencyAdded') });
    setShowAdd(false);
    setSelectedTaskId('');
    fetchDependencies();
    onUpdate?.();
  };

  const handleRemove = async (depId: string) => {
    await supabase.from('task_dependencies').delete().eq('id', depId);
    toast({ title: t('dependencyRemoved') });
    fetchDependencies();
    onUpdate?.();
  };

  // Split into "blocks" and "blocked by" relative to this task
  const blockedBy = dependencies.filter(d => d.task_id === taskId);
  const blocks = dependencies.filter(d => d.depends_on_task_id === taskId);

  const availableTasks = allTasks.filter(t => 
    !dependencies.some(d => 
      (d.task_id === taskId && d.depends_on_task_id === t.id) ||
      (d.depends_on_task_id === taskId && d.task_id === t.id)
    )
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          {t('dependencies')}
        </h4>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)} className="gap-1">
          <Plus className="h-3 w-3" />
          {t('addDependency')}
        </Button>
      </div>

      {showAdd && (
        <div className="flex gap-2 items-end">
          <Select value={depType} onValueChange={setDepType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blocked_by">{t('blockedBy')}</SelectItem>
              <SelectItem value="blocks">{t('blocks')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('selectTask')} />
            </SelectTrigger>
            <SelectContent>
              {availableTasks.map(task => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={!selectedTaskId}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {blockedBy.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Lock className="h-3 w-3" /> {t('blockedBy')}:
          </p>
          {blockedBy.map(dep => {
            const task = taskMap[dep.depends_on_task_id];
            return (
              <div key={dep.id} className="flex items-center gap-2 group">
                <Badge variant="outline" className="text-xs flex-1 justify-start truncate">
                  {task?.title || dep.depends_on_task_id}
                </Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemove(dep.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {blocks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> {t('blocks')}:
          </p>
          {blocks.map(dep => {
            const task = taskMap[dep.task_id];
            return (
              <div key={dep.id} className="flex items-center gap-2 group">
                <Badge variant="outline" className="text-xs flex-1 justify-start truncate">
                  {task?.title || dep.task_id}
                </Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemove(dep.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {dependencies.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground">{t('noDependencies')}</p>
      )}
    </div>
  );
};
