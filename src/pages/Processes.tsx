import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, Sparkles, Search, PlayCircle, LayoutGrid, FileStack } from 'lucide-react';
import { ProcessCard } from '@/components/processes/ProcessCard';

import {
  ProcessCategoriesSidebar,
  ProcessCategory,
} from '@/components/processes/ProcessCategoriesSidebar';
import { ProcessTemplatesDialog } from '@/components/processes/ProcessTemplatesDialog';
import { ActiveRunsList } from '@/components/processes/ActiveRunsList';


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
  category_id: string | null;
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
  const [categories, setCategories] = useState<ProcessCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('my');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();


  useEffect(() => {
    fetchData();
    fetchCategories();
    const handler = () => fetchData();
    window.addEventListener('processes:refresh', handler);
    return () => window.removeEventListener('processes:refresh', handler);
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('process_categories')
      .select('*')
      .order('sort_order')
      .order('name');
    if (data) setCategories(data as ProcessCategory[]);
  };

  const fetchData = async () => {
    setLoading(true);
    const [processesRes, typesRes, deptsRes] = await Promise.all([
      supabase.from('processes').select('*').order('created_at', { ascending: false }),
      supabase.from('process_types').select('*').order('name'),
      supabase.from('departments').select('*').order('name'),
    ]);

    if (processesRes.data) {
      const processesWithDetails = await Promise.all(
        processesRes.data.map(async (proc: any) => {
          const { data: fieldsData } = await supabase
            .from('process_fields')
            .select('*')
            .eq('process_id', proc.id)
            .order('sort_order');
          const processType = typesRes.data?.find((t) => t.id === proc.type_id);
          const department = deptsRes.data?.find((d) => d.id === proc.department_id);
          return {
            ...proc,
            process_type: processType,
            department,
            process_fields: (fieldsData || []).map((f: any) => ({
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
    navigate(`/processes/${process.id}/edit`);
  };


  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    processes.forEach((p) => {
      if (p.category_id) c[p.category_id] = (c[p.category_id] || 0) + 1;
    });
    return c;
  }, [processes]);

  const uncategorizedCount = useMemo(
    () => processes.filter((p) => !p.category_id).length,
    [processes]
  );

  const filteredProcesses = useMemo(() => {
    let list = processes;
    if (selectedCategoryId === '__uncategorized__') {
      list = list.filter((p) => !p.category_id);
    } else if (selectedCategoryId) {
      list = list.filter((p) => p.category_id === selectedCategoryId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [processes, selectedCategoryId, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('processesTitle')}</h1>
          <p className="text-muted-foreground">{t('processesDescription')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            {t('createFromTemplate') || 'З шаблону'}
          </Button>
          <Button onClick={() => navigate('/processes/new')}>

            <Plus className="h-4 w-4 mr-2" />
            {t('createProcess')}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my">
            <LayoutGrid className="h-4 w-4 mr-2" />
            {t('myProcesses') || 'Мої процеси'}
          </TabsTrigger>
          <TabsTrigger value="active">
            <PlayCircle className="h-4 w-4 mr-2" />
            {t('activeRuns') || 'Активні запуски'}
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileStack className="h-4 w-4 mr-2" />
            {t('processTemplates') || 'Шаблони'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              <ProcessCategoriesSidebar
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                onChanged={fetchCategories}
                counts={counts}
                totalCount={processes.length}
                uncategorizedCount={uncategorizedCount}
              />

              <div className="flex-1 min-w-0 space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('searchProcesses') || 'Пошук процесів...'}
                    className="pl-9"
                  />
                </div>

                {filteredProcesses.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <p className="text-muted-foreground mb-4">
                        {processes.length === 0 ? t('noProcesses') : t('nothingFound') || 'Нічого не знайдено'}
                      </p>
                      {processes.length === 0 && (
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t('createFromTemplate') || 'З шаблону'}
                          </Button>
                          <Button onClick={() => navigate('/processes/new')}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('createProcess')}
                          </Button>

                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredProcesses.map((process) => (
                      <ProcessCard key={process.id} process={process} onEdit={handleEdit} categories={categories} onCategoryChanged={fetchData} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <ActiveRunsList />
        </TabsContent>


        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileStack className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {t('openTemplatesLibrary') || 'Відкрити бібліотеку шаблонів'}
              </p>
              <Button onClick={() => setTemplatesOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('browseTemplates') || 'Переглянути шаблони'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>




      <ProcessTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onCreated={fetchData}
      />
    </div>
  );
};

export default Processes;
