import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DateFieldPicker } from '@/components/processes/DateFieldPicker';

interface FieldDef {
  id: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

interface StepRow {
  id: string;
  step_id: string;
  step_label: string | null;
  assignee_id: string | null;
  status: string;
  sla_deadline: string | null;
  sort_order: number;
  step_config: { title?: string; description?: string; fields?: FieldDef[] } | null;
  step_values: Record<string, any> | null;
}

interface ProcessFieldRow {
  id: string;
  name: string;
  field_type: string;
  options: unknown;
  sort_order: number;
}

const STATUSES = ['pending', 'in_progress', 'completed', 'rejected'];

const ProcessRunEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(true);

  const [processTitle, setProcessTitle] = useState('');
  const [runName, setRunName] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; name: string }[]>([]);
  const [processFields, setProcessFields] = useState<ProcessFieldRow[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [rawValues, setRawValues] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [runStatus, setRunStatus] = useState('pending');

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, isAdmin]);

  const load = async () => {
    setLoading(true);
    const { data: run } = await supabase
      .from('process_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!run) {
      setLoading(false);
      return;
    }

    const [{ data: proc }, { data: pFields }, { data: stepRows }, { data: depts }, { data: profs }] =
      await Promise.all([
        supabase.from('processes').select('id, title').eq('id', run.process_id).maybeSingle(),
        supabase.from('process_fields').select('*').eq('process_id', run.process_id).order('sort_order'),
        supabase.from('process_run_steps').select('*').eq('run_id', id).order('sort_order'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('profiles').select('user_id, name').order('name'),
      ]);

    const stepList = (stepRows || []) as unknown as StepRow[];
    const canEdit =
      !!user &&
      (isAdmin ||
        run.started_by === user.id ||
        stepList.some((s) => s.assignee_id === user.id));
    setAllowed(canEdit);

    const values = (run.field_values || {}) as Record<string, any>;
    setRawValues(values);
    setRunName((values._run_name as string) || proc?.title || '');
    setDepartment((values._initiator_department as string) || '');
    setFieldValues(
      Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith('_')))
    );
    setRunStatus(run.status);
    setProcessTitle(proc?.title || '');
    setProcessFields((pFields || []) as ProcessFieldRow[]);
    setSteps(stepList);
    setDepartments(depts || []);
    setProfiles(profs || []);
    setLoading(false);
  };

  const setStep = (idx: number, patch: Partial<StepRow>) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const setStepValue = (idx: number, fieldId: string, value: any) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, step_values: { ...(s.step_values || {}), [fieldId]: value } } : s
      )
    );

  const save = async () => {
    if (!runName.trim()) {
      toast({ title: t('error'), description: t('runName'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const newValues = {
        ...rawValues,
        ...fieldValues,
        _run_name: runName.trim(),
        _initiator_department: department,
      };

      const { error } = await supabase
        .from('process_runs')
        .update({ field_values: newValues, status: runStatus })
        .eq('id', id);
      if (error) throw error;

      for (const s of steps) {
        const { error: sErr } = await supabase
          .from('process_run_steps')
          .update({
            step_label: s.step_label,
            assignee_id: s.assignee_id,
            status: s.status,
            sla_deadline: s.sla_deadline,
            step_values: s.step_values || {},
          })
          .eq('id', s.id);
        if (sErr) throw sErr;
      }

      toast({ title: t('processRunUpdated') || t('saved') });
      navigate(`/processes/runs/${id}`);
    } catch (e: any) {
      toast({ title: t('error'), description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const renderValueInput = (
    type: string,
    value: any,
    onChange: (v: any) => void,
    options?: string[]
  ) => {
    switch (type) {
      case 'textarea':
        return <Textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'number':
        return <Input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      case 'date':
        return <DateFieldPicker value={value ?? ''} onChange={onChange} />;
      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={t('selectOption')} /></SelectTrigger>
            <SelectContent>
              {(options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={value || ''} onValueChange={onChange}>
            {(options || []).map((o) => (
              <div key={o} className="flex items-center gap-2">
                <RadioGroupItem id={`${o}-r`} value={o} />
                <Label htmlFor={`${o}-r`} className="font-normal">{o}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox': {
        const arr: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1.5">
            {(options || []).map((o) => (
              <div key={o} className="flex items-center gap-2">
                <Checkbox
                  id={`${o}-c`}
                  checked={arr.includes(o)}
                  onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))}
                />
                <Label htmlFor={`${o}-c`} className="font-normal">{o}</Label>
              </div>
            ))}
          </div>
        );
      }
      case 'user':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={t('selectUser')} /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'file':
      case 'file_download':
        return (
          <p className="text-xs text-muted-foreground italic">
            {typeof value === 'object' && value ? value.name : String(value || '—')}
          </p>
        );
      default:
        return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">{t('noEditPermission')}</p>
        <Button variant="outline" onClick={() => navigate(`/processes/runs/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />{t('back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/processes/runs/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t('editProcessRunFull')}</h1>
          <p className="text-muted-foreground">{processTitle}</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t('save')}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('basicInfo')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('runName')}</Label>
            <Input value={runName} onChange={(e) => setRunName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('initiatorDepartment')}</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder={t('selectDepartment')} /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('status')}</Label>
            <Select value={runStatus} onValueChange={setRunStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
                  <SelectItem key={s} value={s}>{t(s) || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {processFields.map((pf) => (
            <div key={pf.id} className="space-y-1.5">
              <Label>{pf.name}</Label>
              {renderValueInput(
                pf.field_type,
                fieldValues[pf.name],
                (v) => setFieldValues((p) => ({ ...p, [pf.name]: v })),
                Array.isArray(pf.options) ? (pf.options as string[]) : []
              )}
            </div>
          ))}

          {Object.keys(fieldValues)
            .filter((k) => !processFields.some((pf) => pf.name === k))
            .map((k) => (
              <div key={k} className="space-y-1.5">
                <Label>{k}</Label>
                <Input
                  value={typeof fieldValues[k] === 'object' ? '' : (fieldValues[k] ?? '')}
                  onChange={(e) => setFieldValues((p) => ({ ...p, [k]: e.target.value }))}
                />
              </div>
            ))}
        </CardContent>
      </Card>

      {steps.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('stepsEditing')}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {steps.map((s, idx) => (
              <div key={s.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{idx + 1}</Badge>
                  <Input
                    value={s.step_label || ''}
                    onChange={(e) => setStep(idx, { step_label: e.target.value })}
                    className="flex-1"
                  />
                </div>
                {s.step_config?.description && (
                  <p className="text-xs text-muted-foreground">{s.step_config.description}</p>
                )}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('responsible')}</Label>
                    <Select
                      value={s.assignee_id || ''}
                      onValueChange={(v) => setStep(idx, { assignee_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder={t('selectUser')} /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('status')}</Label>
                    <Select value={s.status} onValueChange={(v) => setStep(idx, { status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((st) => <SelectItem key={st} value={st}>{t(st) || st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('deadline')}</Label>
                    <DateFieldPicker
                      value={s.sla_deadline ? s.sla_deadline.slice(0, 10) : ''}
                      onChange={(v) => setStep(idx, { sla_deadline: new Date(v).toISOString() })}
                    />
                  </div>
                </div>

                {(s.step_config?.fields || []).map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {renderValueInput(
                      f.type,
                      (s.step_values || {})[f.id],
                      (v) => setStepValue(idx, f.id, v),
                      f.options
                    )}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`/processes/runs/${id}`)}>{t('cancel')}</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
};

export default ProcessRunEdit;
