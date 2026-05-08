import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { TaskEditForm } from '@/components/tasks/TaskEditForm';
import { Task } from '@/types/database';

const EditTask = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (error || !data) { navigate('/tasks'); return; }
      setTask(data as unknown as Task);
      setLoading(false);
    })();
  }, [id, navigate]);

  if (loading || !task) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/tasks/${task.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Назад к задаче
        </Button>
        <h1 className="text-2xl font-bold truncate">Редактировать: {task.title}</h1>
      </div>
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <TaskEditForm
          task={task}
          onSuccess={() => navigate(`/tasks/${task.id}`)}
          onCancel={() => navigate(`/tasks/${task.id}`)}
        />
      </div>
    </div>
  );
};

export default EditTask;
