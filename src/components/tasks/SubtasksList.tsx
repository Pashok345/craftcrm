import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, ListChecks } from 'lucide-react';

interface SubtasksListProps {
  taskId: string;
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export const SubtasksList = ({ taskId }: SubtasksListProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSubtask, setNewSubtask] = useState('');

  const { data: subtasks = [] } = useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as Subtask[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder = subtasks.length > 0 ? Math.max(...subtasks.map(s => s.sort_order)) + 1 : 0;
      const { error } = await supabase.from('subtasks').insert({
        task_id: taskId,
        title,
        sort_order: maxOrder,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
      setNewSubtask('');
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from('subtasks')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
  });

  const handleAdd = () => {
    if (!newSubtask.trim()) return;
    addMutation.mutate(newSubtask.trim());
  };

  const completedCount = subtasks.filter(s => s.is_completed).length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {t('subtasks')}
          </h4>
          {subtasks.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {completedCount}/{subtasks.length}
            </span>
          )}
        </div>

        {subtasks.length > 0 && (
          <Progress value={progress} className="mb-4 h-2" />
        )}

        <div className="space-y-2 mb-4">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-3 group py-1"
            >
              <Checkbox
                checked={subtask.is_completed}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ id: subtask.id, isCompleted: !!checked })
                }
              />
              <span
                className={`flex-1 text-sm ${
                  subtask.is_completed ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {subtask.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteMutation.mutate(subtask.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            placeholder={t('addSubtask')}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleAdd}
            disabled={!newSubtask.trim() || addMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
