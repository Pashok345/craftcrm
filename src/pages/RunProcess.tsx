import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Play, Plus, ArrowLeft, Paperclip, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DateFieldPicker } from '@/components/processes/DateFieldPicker';
import { cn } from '@/lib/utils';

interface ProcessField {
  id: string;
  name: string;
  field_type: string;
  options: unknown;
  sort_order: number;
  required?: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface Process {
  id: string;
  title: string;
  description: string | null;
}

interface StoredFile {
  path: string;
  name: string;
}

// IBAN mask utility
const formatIBAN = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const limited = cleaned.slice(0, 34);
  const groups = limited.match(/.{1,4}/g) || [];
  return groups.join(' ');
};

const sanitizeFileName = (name: string) => {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}${ext ? `.${ext}` : ''}`;
};

const RunProcess = () => {
  const { id: processId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [process, setProcess] = useState<Process | null>(null);
  const [runName, setRunName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, StoredFile>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<ProcessField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

  useEffect(() => {
    if (processId) {
      fetchData();
    }
  }, [processId]);

  const fetchData = async () => {
    setLoading(true);

    const [processRes, fieldsRes, deptsRes] = await Promise.all([
      supabase.from('processes').select('id, title, description').eq('id', processId).maybeSingle(),
      supabase.from('process_fields').select('*').eq('process_id', processId).order('sort_order'),
      supabase.from('departments').select('*').order('name'),
    ]);

    if (processRes.data) {
      setProcess(processRes.data);
    }

    if (fieldsRes.data) {
      setFields(fieldsRes.data as ProcessField[]);
      const initialValues: Record<string, string> = {};
      fieldsRes.data.forEach((field) => {
        initialValues[field.name] = '';
      });
      setFieldValues(initialValues);
    }

    if (deptsRes.data) {
      setDepartments(deptsRes.data);
    }

    setLoading(false);
  };

  const addDepartment = async () => {
    if (!newDeptName.trim() || !user) return;
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: newDeptName.trim(), created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      setDepartments([...departments, data]);
      setSelectedDepartment(data.id);
      setNewDeptName('');
      setIsAddingDept(false);
    }
  };

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleFileUpload = async (field: ProcessField, file: File) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [field.name]: t('fileTooLarge') }));
      return;
    }
    setUploading(field.id);
    const path = `${user.id}/${processId}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from('process-attachments')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    setUploading(null);
    if (error) {
      setErrors((prev) => ({ ...prev, [field.name]: error.message }));
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    setFileValues((prev) => ({ ...prev, [field.name]: { path, name: file.name } }));
    clearError(field.name);
  };

  const removeFile = (fieldName: string) => {
    setFileValues((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const requiredMessage = (field: ProcessField) => {
    if (field.field_type === 'file') return t('fieldRequiredFile');
    if (field.field_type === 'select') return t('fieldRequiredSelect');
    return t('fieldRequiredText');
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!runName.trim()) next._run_name = t('fieldRequiredText');
    if (!selectedDepartment) next._department = t('fieldRequiredSelect');
    fields.forEach((field) => {
      if (!field.required) return;
      const filled = field.field_type === 'file'
        ? Boolean(fileValues[field.name])
        : Boolean((fieldValues[field.name] || '').trim());
      if (!filled) next[field.name] = requiredMessage(field);
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validate()) {
      toast({
        title: t('fieldRequired'),
        description: t('fillRequiredFields'),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);

    try {
      // Load workflow definition
      const { data: procData } = await supabase
        .from('processes')
        .select('steps, title')
        .eq('id', processId)
        .maybeSingle();
      const stepsDef: any = (procData as any)?.steps || {};
      const workflow: any[] = Array.isArray(stepsDef.workflow) ? stepsDef.workflow : [];

      const fileEntries = Object.fromEntries(
        Object.entries(fileValues).map(([k, v]) => [k, v.path]),
      );

      const { data, error } = await supabase.from('process_runs').insert({
        process_id: processId,
        field_values: {
          _run_name: runName.trim(),
          _initiator_department: selectedDepartment,
          ...fieldValues,
          ...fileEntries,
        },
        started_by: user.id,
        status: workflow.length > 0 ? 'in_progress' : 'pending',
      }).select().single();

      if (error) throw error;

      // Persist uploaded files as run attachments
      const attachments = Object.entries(fileValues).map(([, v]) => ({
        process_run_id: data.id,
        file_name: v.name,
        file_url: v.path,
        uploaded_by: user.id,
      }));
      if (attachments.length > 0) {
        await supabase.from('process_run_attachments').insert(attachments);
      }

      // Materialize workflow steps
      if (data && workflow.length > 0) {
        const stepsRows = workflow.map((w, idx) => {
          const responsibleField = (w.fields || []).find((f: any) => f.type === 'user' && f.assignee_user_id);
          const assignee = responsibleField?.assignee_user_id
            || (w.assignee_mode === 'user' && w.assignee_id ? w.assignee_id : user.id);
          return {
            run_id: data.id,
            step_id: w.id,
            step_type: 'task',
            step_label: w.title || null,
            assignee_id: assignee,
            status: idx === 0 ? 'in_progress' : 'pending',
            started_at: idx === 0 ? new Date().toISOString() : null,
            sla_deadline: w.sla_hours ? new Date(Date.now() + w.sla_hours * 3600_000).toISOString() : null,
            sort_order: idx,
            step_config: w,
            step_values: {},
          };
        });

        const { error: stepsError } = await supabase.from('process_run_steps').insert(stepsRows);
        if (stepsError) throw stepsError;
        await supabase.from('process_runs').update({ current_step_id: stepsRows[0].step_id }).eq('id', data.id);

        const first = stepsRows[0];
        if (first.assignee_id && first.assignee_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: first.assignee_id,
            type: 'process_step',
            title: t('processStepAssignedTitle'),
            message: `${procData?.title || ''}: ${first.step_label || ''}`,
          });
        }
      }

      toast({ title: t('processStarted') });
      navigate(`/processes/runs/${data.id}`);
    } catch (error: any) {
      console.error('Error:', error);
      toast({ title: t('error'), description: error?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const updateFieldValue = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
    clearError(fieldName);
  };

  const handleIBANChange = (fieldName: string, value: string) => {
    updateFieldValue(fieldName, formatIBAN(value));
  };

  const isIBANField = (fieldName: string) => {
    const lowerName = fieldName.toLowerCase();
    return lowerName.includes('iban') || lowerName.includes('ібан') || lowerName.includes('счет') || lowerName.includes('рахунок');
  };

  const renderField = (field: ProcessField) => {
    const hasError = Boolean(errors[field.name]);
    const errCls = hasError ? 'border-destructive focus-visible:ring-destructive' : '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            className={errCls}
            value={fieldValues[field.name] || ''}
            onChange={(e) => updateFieldValue(field.name, e.target.value)}
            rows={3}
          />
        );
      case 'date':
        return (
          <div className={cn(hasError && 'rounded-md ring-1 ring-destructive')}>
            <DateFieldPicker
              value={fieldValues[field.name] || ''}
              onChange={(val) => updateFieldValue(field.name, val)}
            />
          </div>
        );
      case 'file': {
        const stored = fileValues[field.name];
        return (
          <div className="space-y-2">
            {stored ? (
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border bg-muted/40">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{stored.name}</span>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(field.name)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Input
                type="file"
                className={errCls}
                disabled={uploading === field.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(field, file);
                  e.target.value = '';
                }}
              />
            )}
            {uploading === field.id && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> {t('uploading')}
              </p>
            )}
          </div>
        );
      }
      case 'select': {
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <Select
            value={fieldValues[field.name] || ''}
            onValueChange={(value) => updateFieldValue(field.name, value)}
          >
            <SelectTrigger className={errCls}>
              <SelectValue placeholder={t('selectOption')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      default:
        if (isIBANField(field.name)) {
          return (
            <Input
              value={fieldValues[field.name] || ''}
              onChange={(e) => handleIBANChange(field.name, e.target.value)}
              placeholder="UA00 0000 0000 0000 0000 0000 0000 0"
              className={cn('font-mono', errCls)}
            />
          );
        }
        return (
          <Input
            className={errCls}
            value={fieldValues[field.name] || ''}
            onChange={(e) => updateFieldValue(field.name, e.target.value)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!process) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('processNotFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProcesses')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('runProcess')}</h1>
          <p className="text-muted-foreground">{process.title}</p>
        </div>
      </div>

      {process.description && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium text-foreground mb-2">{t('processDescription')}</h3>
            <p className="text-sm text-muted-foreground">{process.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Required: Run Name */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('runName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={runName}
                onChange={(e) => {
                  setRunName(e.target.value);
                  clearError('_run_name');
                }}
                placeholder={t('enterRunName')}
                className={errors._run_name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors._run_name && <p className="text-xs text-destructive">{errors._run_name}</p>}
            </div>

            {/* Required: Initiator Department */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('initiatorDepartment')} <span className="text-destructive">*</span>
              </Label>
              {isAddingDept ? (
                <div className="flex gap-2">
                  <Input
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder={t('newDepartmentName')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={addDepartment}>{t('add')}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingDept(false)}>{t('cancel')}</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={selectedDepartment}
                    onValueChange={(v) => {
                      setSelectedDepartment(v);
                      clearError('_department');
                    }}
                  >
                    <SelectTrigger className={cn('flex-1', errors._department && 'border-destructive focus:ring-destructive')}>
                      <SelectValue placeholder={t('selectDepartment')} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setIsAddingDept(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {errors._department && <p className="text-xs text-destructive">{errors._department}</p>}
            </div>

            {/* Dynamic process fields */}
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label className="flex items-center gap-1">
                  {field.name}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                {renderField(field)}
                {errors[field.name] && <p className="text-xs text-destructive">{errors[field.name]}</p>}
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/processes')}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting || Boolean(uploading)}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {t('startProcess')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RunProcess;
