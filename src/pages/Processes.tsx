import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2 } from 'lucide-react';
import { ProcessDialog } from '@/components/processes/ProcessDialog';
import { ProcessCard } from '@/components/processes/ProcessCard';
import { toast } from '@/hooks/use-toast';

interface ProcessType {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface ProcessField {
  id: string;
  name: string;
  field_type: string;
  options: string[] | null;
  sort_order: number;
}

interface Process {
  id: string;
  title: string;
  description: string | null;
  type_id: string | null;
  department_id: string | null;
  status: string;
  created_by: string;
  created_at: string;
  process_type?: ProcessType;
  department?: Department;
  process_fields?: ProcessField[];
}

const Processes = () => {
  const { t } = useLanguage();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [processesRes, typesRes, deptsRes] = await Promise.all([
      supabase
        .from('processes')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('process_types').select('*').order('name'),
      supabase.from('departments').select('*').order('name'),
    ]);

    if (processesRes.data) {
      // Fetch fields for each process
      const processesWithDetails = await Promise.all(
        processesRes.data.map(async (proc) => {
          const [fieldsRes] = await Promise.all([
            supabase
              .from('process_fields')
              .select('*')
              .eq('process_id', proc.id)
              .order('sort_order'),
          ]);
          
          const processType = typesRes.data?.find(t => t.id === proc.type_id);
          const department = deptsRes.data?.find(d => d.id === proc.department_id);
          
          return {
            ...proc,
            process_type: processType,
            department: department,
            process_fields: (fieldsRes.data || []).map((f: any) => ({
              ...f,
              options: Array.isArray(f.options) ? f.options : null,
            })),
          } as Process;
        })
      );
      setProcesses(processesWithDetails);
    }
    
    if (typesRes.data) setProcessTypes(typesRes.data);
    if (deptsRes.data) setDepartments(deptsRes.data);
    
    setLoading(false);
  };

  const handleEdit = (process: Process) => {
    setEditingProcess(process);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingProcess(null);
  };

  const handleSaved = () => {
    handleDialogClose();
    fetchData();
    toast({
      title: editingProcess ? t('processUpdated') : t('processCreated'),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('processesTitle')}</h1>
          <p className="text-muted-foreground">{t('processesDescription')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createProcess')}
        </Button>
      </div>

      {processes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">{t('noProcesses')}</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createProcess')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {processes.map((process) => (
            <ProcessCard 
              key={process.id} 
              process={process} 
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <ProcessDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        process={editingProcess}
        processTypes={processTypes}
        departments={departments}
        onSaved={handleSaved}
        onTypesChange={fetchData}
        onDepartmentsChange={fetchData}
      />
    </div>
  );
};

export default Processes;
