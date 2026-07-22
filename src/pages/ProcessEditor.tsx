import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, Loader2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { WorkflowStepsEditor, WorkflowStep } from '@/components/processes/WorkflowStepsEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

interface ProcessType { id: string; name: string; }
interface Department { id: string; name: string; }
interface Category { id: string; name: string; color: string; }
interface ProcessField {
  id?: string;
  name: string;
  field_type: string;
  options: string[] | null;
  sort_order: number;
  required?: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'fieldTypeText' },
  { value: 'textarea', label: 'fieldTypeTextarea' },
  { value: 'select', label: 'fieldTypeSelect' },
  { value: 'file', label: 'fieldTypeFile' },
];

const ProcessEditor = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const templateData = (location.state as any)?.template;
  const { user } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeId, setTypeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fields, setFields] = useState<ProcessField[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);

  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [initialFieldIds, setInitialFieldIds] = useState<string[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  useEffect(() => {
    (async () => {
      const [typesRes, deptsRes, catsRes] = await Promise.all([
        supabase.from('process_types').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('process_categories').select('*').order('sort_order').order('name'),
      ]);
      setProcessTypes(typesRes.data || []);
      setDepartments(deptsRes.data || []);
      setCategories((catsRes.data as Category[]) || []);

      if (isEdit && id) {
        const { data: proc } = await supabase.from('processes').select('*').eq('id', id).maybeSingle();
        if (proc) {
          setTitle(proc.title);
          setDescription(proc.description || '');
          setTypeId(proc.type_id || '');
          setDepartmentId(proc.department_id || '');
          setCategoryId(proc.category_id || '');
          const s: any = (proc as any).steps;
          setWorkflow(Array.isArray(s?.workflow) ? s.workflow : []);
        }
        const { data: fData } = await supabase
          .from('process_fields')
          .select('*')
          .eq('process_id', id)
          .order('sort_order');
        const mapped = (fData || []).map((f: any) => ({
          ...f,
          options: Array.isArray(f.options) ? f.options : null,
        }));
        setFields(mapped);
        setInitialFieldIds(mapped.map((f) => f.id).filter(Boolean));
        setLoading(false);
      } else if (templateData) {
        setTitle(templateData.title || '');
        setDescription(templateData.description || '');
        setFields(templateData.fields || []);
      }
    })();
  }, [id, isEdit]);


  const addField = () =>
    setFields([...fields, { name: '', field_type: 'text', options: null, sort_order: fields.length }]);

  const updateField = (i: number, patch: Partial<ProcessField>) => {
    const copy = [...fields];
    copy[i] = { ...copy[i], ...patch };
    setFields(copy);
  };

  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));

  const addNewType = async () => {
    if (!newTypeName.trim() || !user) return;
    const { data, error } = await supabase
      .from('process_types')
      .insert({ name: newTypeName.trim(), created_by: user.id })
      .select()
      .single();
    if (!error && data) {
      setProcessTypes((p) => [...p, data]);
      setTypeId(data.id);
      setNewTypeName('');
    }
  };

  const addNewDept = async () => {
    if (!newDeptName.trim() || !user) return;
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: newDeptName.trim(), created_by: user.id })
      .select()
      .single();
    if (!error && data) {
      setDepartments((d) => [...d, data]);
      setDepartmentId(data.id);
      setNewDeptName('');
    }
  };

  const canGoNext = title.trim().length > 0;

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);
    try {
      let processId = id;
      if (isEdit && id) {
        const { error } = await supabase
          .from('processes')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            type_id: typeId || null,
            department_id: departmentId || null,
            category_id: categoryId || null,
            steps: { workflow } as any,
          })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('processes')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            type_id: typeId || null,
            department_id: departmentId || null,
            category_id: categoryId || null,
            steps: { workflow } as any,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        processId = data.id;
      }

      if (processId) {
        const currentIds = fields.filter((f) => f.id).map((f) => f.id!);
        const toDelete = initialFieldIds.filter((fid) => !currentIds.includes(fid));
        if (toDelete.length) {
          await supabase.from('process_fields').delete().in('id', toDelete);
        }
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          if (f.id) {
            await supabase.from('process_fields').update({
              name: f.name, field_type: f.field_type, options: f.options, sort_order: i, required: (f as any).required || false,
            }).eq('id', f.id);
          } else if (f.name.trim()) {
            await supabase.from('process_fields').insert({
              process_id: processId,
              name: f.name, field_type: f.field_type, options: f.options, sort_order: i, required: (f as any).required || false,
            });
          }
        }
      }

      toast({ title: isEdit ? t('processUpdated') : t('processCreated') });
      navigate('/processes');
    } catch (e) {
      console.error(e);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isEdit ? (t('editProcess') || 'Редагування процесу') : (t('createProcess') || 'Створення процесу')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 1
              ? (t('processStep1Hint') || 'Крок 1 з 3 — основні дані процесу')
              : step === 2
                ? (t('processStep2Hint') || 'Крок 2 з 3 — схема виконання')
                : (t('processStep3Hint') || 'Крок 3 з 3 — перевірка процесу')}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (n === 1 || canGoNext) && setStep(n as 1 | 2 | 3)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                step === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
              }`}
            >
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                step === n ? 'bg-primary-foreground/20' : 'bg-muted'
              }`}>{n}</span>
              {n === 1
                ? (t('basicData') || 'Основні дані')
                : n === 2
                  ? (t('processScheme') || 'Схема процесу')
                  : (t('processPreview') || 'Перевірка')}
            </button>
            {n < 3 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>


      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label>{t('processName') || 'Назва процесу'} *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                     placeholder={t('enterProcessName') || 'Наприклад, Погодження оплати рахунку'} />
            </div>

            <div className="space-y-2">
              <Label>{t('description') || 'Опис'}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder={t('processDescriptionPlaceholder') || 'Для чого потрібен процес і коли його запускати'} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {categories.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('category') || 'Категорія'}</Label>
                  <Select value={categoryId || '__none__'}
                          onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder={t('selectCategory') || 'Оберіть категорію'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('uncategorized') || 'Без категорії'}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('processType') || 'Тип процесу'}</Label>
                <Select value={typeId || '__none__'} onValueChange={(v) => setTypeId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder={t('selectType') || 'Оберіть тип'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {processTypes.map((tp) => <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)}
                         placeholder={t('newTypeName') || 'Новий тип...'} />
                  <Button size="sm" variant="outline" onClick={addNewType}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('responsibleDepartment') || 'Відповідальний відділ'}</Label>
                <Select value={departmentId || '__none__'} onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder={t('selectDepartment') || 'Оберіть відділ'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                         placeholder={t('newDepartmentName') || 'Новий відділ...'} />
                  <Button size="sm" variant="outline" onClick={addNewDept}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('customFields') || 'Поля запуску'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('customFieldsHint') || 'Дані, які потрібно заповнити при запуску процесу (напр. сума, контрагент, коментар).'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="h-4 w-4 mr-1" />{t('addField') || 'Додати поле'}
                </Button>
              </div>

              {fields.map((f, i) => (
                <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/40">
                  <div className="flex-1 space-y-2">
                    <Input value={f.name} onChange={(e) => updateField(i, { name: e.target.value })}
                           placeholder={t('fieldName') || 'Назва поля'} />
                    <Select value={f.field_type} onValueChange={(v) => updateField(i, { field_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((tp) => (
                          <SelectItem key={tp.value} value={tp.value}>{t(tp.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {f.field_type === 'select' && (
                      <Input value={f.options?.join(', ') || ''}
                             onChange={(e) => updateField(i, {
                               options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                             })}
                             placeholder={t('selectOptionsPlaceholder') || 'Варіанти через кому'} />
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Switch checked={!!f.required} onCheckedChange={(c) => updateField(i, { required: c })} />
                      <Label className="text-xs">{t('fieldRequired') || 'Обовʼязкове'}</Label>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeField(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('howWorkflowWorks') || 'Як працює робочий процес'}</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {t('workflowHelp') ||
                'Створіть послідовність кроків. На кожному кроці додайте поля (текст, файл, вибір зі списку тощо), позначте обовʼязкові та оберіть виконавця. При запуску процесу користувач заповнить перший крок, після завершення система передасть наступний крок наступному виконавцю.'}
            </AlertDescription>
          </Alert>
          <WorkflowStepsEditor value={workflow} onChange={setWorkflow} />
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => navigate('/processes')}>
          {t('cancel') || 'Скасувати'}
        </Button>
        <div className="flex gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />{t('back') || 'Назад'}
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!canGoNext}>
              {t('next') || 'Далі'}<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t('save') || 'Зберегти'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessEditor;
