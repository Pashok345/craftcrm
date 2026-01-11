import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Edit, List, Loader2 } from 'lucide-react';
import { ProcessDialog } from '@/components/processes/ProcessDialog';
import { ProcessRunsDialog } from '@/components/processes/ProcessRunsDialog';
import { RunProcessDialog } from '@/components/processes/RunProcessDialog';
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
  const { user } = useAuth();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [runsDialogProcess, setRunsDialogProcess] = useState<Process | null>(null);
  const [runDialogProcess, setRunDialogProcess] = useState<Process | null>(null);

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
            <Card key={process.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{process.title}</CardTitle>
                  <Badge variant="outline">{process.process_type?.name || t('noType')}</Badge>
                </div>
                {process.department && (
                  <Badge variant="secondary" className="w-fit">{process.department.name}</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {process.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {process.description}
                  </p>
                )}
                
                {process.process_fields && process.process_fields.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t('fields')}: {process.process_fields.length}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => setRunDialogProcess(process)}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {t('runProcess')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEdit(process)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setRunsDialogProcess(process)}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
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

      {runsDialogProcess && (
        <ProcessRunsDialog
          open={!!runsDialogProcess}
          onOpenChange={() => setRunsDialogProcess(null)}
          process={runsDialogProcess}
        />
      )}

      {runDialogProcess && (
        <RunProcessDialog
          open={!!runDialogProcess}
          onOpenChange={() => setRunDialogProcess(null)}
          process={runDialogProcess}
          onRun={() => {
            setRunDialogProcess(null);
            toast({ title: t('processStarted') });
          }}
        />
      )}
    </div>
  );
};

export default Processes;
