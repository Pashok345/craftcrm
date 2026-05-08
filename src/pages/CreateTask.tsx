import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TaskCreateForm } from '@/components/tasks/TaskCreateForm';

const CreateTask = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Назад
        </Button>
        <h1 className="text-2xl font-bold">Новая задача</h1>
      </div>
      <div className="rounded-lg border bg-card p-4 md:p-6">
        <TaskCreateForm
          onSuccess={(taskId) => navigate(taskId ? `/tasks/${taskId}` : '/tasks')}
          onCancel={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default CreateTask;
