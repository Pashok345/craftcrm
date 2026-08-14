import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, Clock, GitBranch, AlertTriangle, Loader2, Paperclip } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DateFieldPicker } from '@/components/processes/DateFieldPicker';

interface Profile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface FieldDef {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'file_download' | 'user' | 'button';
  sample_url?: string | null;
  sample_name?: string | null;
  assignee_user_id?: string | null;
  required?: boolean;
  options?: string[];
}


interface StepConfig {
  id: string;
  title: string;
  description?: string;
  assignee_mode: 'initiator' | 'user' | 'ask';
  assignee_id?: string | null;
  sla_hours?: number | null;
  fields: FieldDef[];
}

interface Step {
  id: string;
  run_id: string;
  step_id: string;
  step_label: string | null;
  assignee_id: string | null;
  status: string;
  comment: string | null;
  sla_deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  sort_order: number;
  step_config: StepConfig | null;
  step_values: Record<string, any> | null;
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/30',
};

interface Props {
  runId: string;
  initiatorId: string;
}

export function RunStepsPanel({ runId, initiatorId }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [steps, setSteps] = useState<Step[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [valuesDrafts, setValuesDrafts] = useState<Record<string, Record<string, any>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [rejectMode, setRejectMode] = useState<Record<string, boolean>>({});


  // Creates run steps from the process workflow if they were never materialized
  const materializeSteps = async (): Promise<Step[]> => {
    if (!user) return [];
    const { data: run } = await supabase
      .from('process_runs')
      .select('id, process_id, started_by')
      .eq('id', runId)
      .maybeSingle();
    if (!run) return [];
    const { data: proc } = await supabase
      .from('processes')
      .select('steps, title')
      .eq('id', run.process_id)
      .maybeSingle();
    const workflow: any[] = Array.isArray((proc as any)?.steps?.workflow) ? (proc as any).steps.workflow : [];
    if (workflow.length === 0) return [];

    const rows = workflow.map((w: any, idx: number) => {
      const responsibleField = (w.fields || []).find((f: any) => f.type === 'user' && f.assignee_user_id);
      const assignee = responsibleField?.assignee_user_id
        || (w.assignee_mode === 'user' && w.assignee_id ? w.assignee_id : run.started_by);
      return {
        run_id: runId,
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

    const { data: inserted, error } = await supabase
      .from('process_run_steps')
      .insert(rows)
      .select();
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return [];
    }
    await supabase
      .from('process_runs')
      .update({ current_step_id: rows[0].step_id, status: 'in_progress' })
      .eq('id', runId);
    return (inserted || []) as unknown as Step[];
  };

  const load = async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from('process_run_steps').select('*').eq('run_id', runId).order('sort_order'),
      supabase.from('profiles').select('user_id, name, avatar_url, avatar_color'),
    ]);
    let list = (sRes.data || []) as unknown as Step[];
    if (list.length === 0) {
      list = (await materializeSteps()).sort((a, b) => a.sort_order - b.sort_order);
    }
    setSteps(list);
    if (pRes.data) {
      const m: Record<string, Profile> = {};
      pRes.data.forEach((p: any) => { m[p.user_id] = p; });
      setProfiles(m);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [runId]);

  const setFieldValue = (stepId: string, fieldId: string, val: any) => {
    setValuesDrafts(d => ({
      ...d,
      [stepId]: { ...(d[stepId] || {}), [fieldId]: val },
    }));
    setErrors(e => {
      if (!e[stepId]?.[fieldId]) return e;
      const next = { ...(e[stepId] || {}) };
      delete next[fieldId];
      return { ...e, [stepId]: next };
    });
  };

  // Storage keys must be ASCII-safe: keep the original name for display only
  const sanitizeFileName = (name: string) => {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const base = (dot > 0 ? name.slice(0, dot) : name)
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return `${base || 'file'}${ext ? `.${ext}` : ''}`;
  };

  const uploadFile = async (stepId: string, fieldId: string, file: File) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      setErrors(e => ({ ...e, [stepId]: { ...(e[stepId] || {}), [fieldId]: t('fileTooLarge') } }));
      return;
    }
    const path = `${user.id}/${runId}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from('process-attachments')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) {
      setErrors(e => ({ ...e, [stepId]: { ...(e[stepId] || {}), [fieldId]: error.message } }));
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    setFieldValue(stepId, fieldId, { path, name: file.name });
  };

  const downloadStoredFile = async (val: any) => {
    const path = typeof val === 'object' && val ? val.path : String(val);
    const name = typeof val === 'object' && val ? val.name : path.split('/').pop();
    if (!path) return;
    if (/^https?:\/\//.test(path)) {
      window.open(path, '_blank', 'noopener');
      return;
    }
    const { data, error } = await supabase.storage
      .from('process-attachments')
      .download(path);
    if (error || !data) {
      toast({ title: t('error'), description: error?.message, variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const notifyAssignee = async (userId: string | null, stepLabel: string | null) => {

    if (!userId || !user || userId === user.id) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'process_step',
      title: t('processStepAssignedTitle'),
      message: stepLabel || '',
    });
  };

  const requiredMessage = (f: FieldDef) => {
    if (f.type === 'file') return t('fieldRequiredFile');
    if (f.type === 'select' || f.type === 'radio' || f.type === 'user') return t('fieldRequiredSelect');
    if (f.type === 'checkbox') return t('fieldRequiredCheckbox');
    return t('fieldRequiredText');
  };

  const completeStep = async (
    step: Step,
    action: 'approve' | 'reject' | 'revise' = 'approve',
    buttonLabel?: string,
    overrides?: Record<string, any>,
  ) => {
    if (!user) return;
    const cfg = step.step_config;
    const draft = { ...(valuesDrafts[step.id] || (step.step_values as any) || {}), ...(overrides || {}) };
    if (buttonLabel) draft._action = buttonLabel;


    // Validate required (skip on reject/revise)
    if (action === 'approve' && cfg?.fields) {
      const stepErrors: Record<string, string> = {};
      for (const f of cfg.fields) {
        if (f.required && f.type !== 'button' && f.type !== 'file_download') {
          const v = draft[f.id];
          const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
          if (empty) stepErrors[f.id] = requiredMessage(f);
        }
      }
      if (Object.keys(stepErrors).length > 0) {
        setErrors(e => ({ ...e, [step.id]: stepErrors }));
        toast({
          title: t('fieldRequired'),
          description: t('fillRequiredFields'),
          variant: 'destructive',
        });
        return;
      }
      setErrors(e => ({ ...e, [step.id]: {} }));
    }


    setBusy(step.id);

    if (action === 'reject') {
      await supabase.from('process_run_steps').update({
        status: 'rejected',
        completed_at: new Date().toISOString(),
        step_values: draft,
      }).eq('id', step.id);
      await supabase.from('process_runs').update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
      await load();
      toast({ title: t('status_cancelled') });
      setBusy(null);
      return;
    }

    if (action === 'revise') {
      const prev = [...steps].reverse().find(s => s.sort_order < step.sort_order);
      await supabase.from('process_run_steps').update({
        status: 'pending',
        step_values: draft,
      }).eq('id', step.id);
      if (prev) {
        await supabase.from('process_run_steps').update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          completed_at: null,
        }).eq('id', prev.id);
        await supabase.from('process_runs').update({ current_step_id: prev.step_id, status: 'in_progress' }).eq('id', runId);
        await notifyAssignee(prev.assignee_id, prev.step_label);
      }
      await load();
      toast({ title: t('buttonActionRevise') });
      setBusy(null);
      return;
    }

    const { error } = await supabase.from('process_run_steps').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      step_values: draft,
      started_at: step.started_at || new Date().toISOString(),
    }).eq('id', step.id);

    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      setBusy(null);
      return;
    }

    // Activate next
    const next = steps.find(s => s.sort_order > step.sort_order && s.status === 'pending');
    if (next) {
      await supabase.from('process_run_steps').update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      }).eq('id', next.id);
      await supabase.from('process_runs').update({ current_step_id: next.step_id, status: 'in_progress' }).eq('id', runId);
      await notifyAssignee(next.assignee_id, next.step_label);
    } else {
      await supabase.from('process_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    }

    await load();
    toast({ title: t('statusUpdated') });
    setBusy(null);
  };

  const initials = (n?: string) => (n || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const renderField = (step: Step, f: FieldDef) => {
    const draft = valuesDrafts[step.id] || (step.step_values as any) || {};
    const v = draft[f.id];
    const set = (val: any) => setFieldValue(step.id, f.id, val);
    const readOnly = step.status !== 'in_progress';
    const invalid = !!errors[step.id]?.[f.id];
    const err = invalid ? 'border-destructive focus-visible:ring-destructive' : '';

    switch (f.type) {
      case 'textarea':
        return <Textarea rows={3} className={err} value={v || ''} onChange={(e) => set(e.target.value)} disabled={readOnly} />;
      case 'date':
        return <DateFieldPicker value={v || ''} onChange={set} disabled={readOnly} invalid={invalid} />;
      case 'number':
        return <Input type="number" className={err} value={v ?? ''} onChange={(e) => set(e.target.value)} disabled={readOnly} />;
      case 'select':
        return (
          <Select value={v || ''} onValueChange={set} disabled={readOnly}>
            <SelectTrigger className={err}><SelectValue placeholder={t('selectOption')} /></SelectTrigger>
            <SelectContent>
              {(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup
            value={v || ''}
            onValueChange={set}
            disabled={readOnly}
            className={invalid ? 'rounded-md border border-destructive p-2' : ''}
          >
            {(f.options || []).map(o => (
              <div key={o} className="flex items-center gap-2">
                <RadioGroupItem id={`${f.id}-${o}`} value={o} />
                <Label htmlFor={`${f.id}-${o}`} className="font-normal">{o}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox': {
        const arr: string[] = Array.isArray(v) ? v : [];
        return (
          <div className={`space-y-1.5 ${invalid ? 'rounded-md border border-destructive p-2' : ''}`}>
            {(f.options || []).map(o => (
              <div key={o} className="flex items-center gap-2">
                <Checkbox
                  id={`${f.id}-${o}`}
                  checked={arr.includes(o)}
                  disabled={readOnly}
                  onCheckedChange={(c) => set(c ? [...arr, o] : arr.filter(x => x !== o))}
                />
                <Label htmlFor={`${f.id}-${o}`} className="font-normal">{o}</Label>
              </div>
            ))}
          </div>
        );
      }
      case 'file':
        return (
          <div className="space-y-1">
            {!readOnly && (
              <Input
                type="file"
                className={err}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(step.id, f.id, file);
                }}
              />
            )}
            {v && (
              <button
                type="button"
                onClick={() => downloadStoredFile(v)}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted transition-colors"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[220px] truncate">
                  {typeof v === 'object' ? v.name : String(v).split('/').pop()}
                </span>
                <span className="text-muted-foreground">↓</span>
              </button>
            )}

          </div>
        );
      case 'file_download':
        return f.sample_url ? (
          <a
            href={f.sample_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border bg-muted/40 hover:bg-muted transition-colors"
          >
            <Paperclip className="h-4 w-4" />
            {f.sample_name || (t('downloadSample'))}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t('noSampleFile')}</p>
        );
      case 'user': {
        // Predefined approver: no user picker, only confirm / decline
        if (f.assignee_user_id) {
          const approver = profiles[f.assignee_user_id];
          const decision = typeof v === 'object' && v ? v.decision : null;
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={approver?.avatar_url || undefined} />
                  <AvatarFallback style={{ backgroundColor: approver?.avatar_color || undefined }} className="text-[10px]">
                    {initials(approver?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">{approver?.name || '—'}</span>
                {decision && (
                  <Badge variant="outline" className={decision === 'approved' ? STATUS_CLS.completed : STATUS_CLS.rejected}>
                    {decision === 'approved'
                      ? (t('confirmDecisionYes'))
                      : (t('confirmDecisionNo'))}
                  </Badge>
                )}
              </div>
              {decision === 'rejected' && v?.comment && (
                <p className="text-xs text-muted-foreground">{v.comment}</p>
              )}
            </div>
          );
        }
        return (
          <Select value={v || ''} onValueChange={set} disabled={readOnly}>
            <SelectTrigger className={err}><SelectValue placeholder={t('selectUser')} /></SelectTrigger>
            <SelectContent>
              {Object.values(profiles).map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case 'button':
        return null;
      default:
        return <Input className={err} value={v || ''} onChange={(e) => set(e.target.value)} disabled={readOnly} />;
    }
  };


  const actionForOption = (label: string): 'approve' | 'reject' | 'revise' => {
    const l = label.toLowerCase();
    if (l.includes(String(t('buttonActionRevise')).toLowerCase()) || l.includes('доопрац') || l.includes('revis')) return 'revise';
    if (l.includes(String(t('buttonActionReject')).toLowerCase()) || l.includes('скасув') || l.includes('cancel') || l.includes('отмен') || l.includes('reject')) return 'reject';
    return 'approve';
  };



  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (steps.length === 0) return null;

  const doneCount = steps.filter(s => s.status === 'completed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('processSteps')}
          <Badge variant="outline" className="ml-auto font-normal">
            {doneCount} / {steps.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal overview of all steps */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {steps.map((s, i) => {
            const color = s.status === 'completed' ? '#22c55e'
              : s.status === 'in_progress' ? '#3b82f6'
              : s.status === 'rejected' ? '#ef4444' : '#94a3b8';
            return (
              <div key={s.id} className="flex items-center gap-1 shrink-0">
                <div
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: color, color, backgroundColor: `${color}14` }}
                  title={s.step_label || ''}
                >
                  <span className="font-semibold">{i + 1}</span>
                  <span className="max-w-[140px] truncate">{s.step_label || s.step_config?.title || ''}</span>
                </div>
                {i < steps.length - 1 && <div className="h-px w-4 bg-border" />}
              </div>
            );
          })}
        </div>


        {steps.map((step, idx) => {
          const cfg = step.step_config;
          const assignee = step.assignee_id ? profiles[step.assignee_id] : null;
          const active = step.status === 'in_progress';
          const canAct = user && active && (user.id === step.assignee_id || user.id === initiatorId);
          const overdue = step.sla_deadline && new Date(step.sla_deadline) < new Date() && active;

          return (
            <div
              key={step.id}
              className="border rounded-lg p-4 transition-colors"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: active ? '#3b82f6' : step.status === 'completed' ? '#22c55e' : '#94a3b8',
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('step')} {idx + 1}
                </span>
                <span className="font-medium">{step.step_label || cfg?.title}</span>
                <Badge variant="outline" className={STATUS_CLS[step.status] || ''}>
                  {t(`stepStatus_${step.status}`) || step.status}
                </Badge>
                {overdue && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />SLA
                  </Badge>
                )}
                {assignee && (
                  <div className="flex items-center gap-1.5 ml-auto text-xs">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={assignee.avatar_url || undefined} />
                      <AvatarFallback style={{ backgroundColor: assignee.avatar_color || undefined }} className="text-[10px]">
                        {initials(assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">{assignee.name}</span>
                  </div>
                )}
              </div>

              {cfg?.description && (
                <p className="text-sm text-muted-foreground mt-2">{cfg.description}</p>
              )}

              {step.sla_deadline && (
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(step.sla_deadline), 'dd.MM.yyyy HH:mm')}
                </div>
              )}

              {cfg?.fields && cfg.fields.length > 0 && (active || step.status === 'completed' || step.status === 'rejected') && (
                <div className="mt-3 space-y-3">
                  {cfg.fields.filter(f => f.type !== 'button').map((f) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label className={`text-xs ${errors[step.id]?.[f.id] ? 'text-destructive' : ''}`}>
                        {f.label}
                        {f.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {renderField(step, f)}
                      {errors[step.id]?.[f.id] && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {errors[step.id][f.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const approvalField = (cfg?.fields || []).find(f => f.type === 'user' && f.assignee_user_id);
                if (!approvalField) return null;
                if (!active) return null;
                const isApprover = user?.id === approvalField.assignee_user_id;
                if (!isApprover) {
                  return (
                    <p className="mt-4 text-xs text-muted-foreground italic text-center">
                      {t('waitingForApprover')}
                    </p>
                  );
                }
                const rejecting = !!rejectMode[step.id];
                const comment = (valuesDrafts[step.id] || {})._reject_comment || '';
                return (
                  <div className="mt-4 space-y-3">
                    {rejecting && (
                      <div className="space-y-1.5">
                        <Label className={`text-xs ${errors[step.id]?._reject_comment ? 'text-destructive' : ''}`}>
                          {t('declineCommentLabel')}
                          <span className="text-destructive ml-0.5">*</span>
                        </Label>
                        <Textarea
                          rows={3}
                          className={errors[step.id]?._reject_comment ? 'border-destructive focus-visible:ring-destructive' : ''}
                          value={comment}
                          onChange={(e) => setFieldValue(step.id, '_reject_comment', e.target.value)}
                          placeholder={t('declineCommentPlaceholder')}
                        />
                        {errors[step.id]?._reject_comment && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {errors[step.id]._reject_comment}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        size="lg"
                        disabled={busy === step.id}
                        onClick={() => {
                          setRejectMode(m => ({ ...m, [step.id]: false }));
                          completeStep(step, 'approve', undefined, {
                            [approvalField.id]: { decision: 'approved', by: user?.id },
                          });
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('confirmDecisionYes')}
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        disabled={busy === step.id}
                        onClick={() => {
                          if (!rejecting) {
                            setRejectMode(m => ({ ...m, [step.id]: true }));
                            return;
                          }
                          if (!String(comment).trim()) {
                            setErrors(e => ({
                              ...e,
                              [step.id]: {
                                ...(e[step.id] || {}),
                                _reject_comment: t('declineCommentRequired'),
                              },
                            }));
                            return;
                          }
                          completeStep(step, 'reject', undefined, {
                            [approvalField.id]: { decision: 'rejected', by: user?.id, comment },
                          });
                        }}
                      >
                        {t('confirmDecisionNo')}
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {canAct && !(cfg?.fields || []).some(f => f.type === 'user' && f.assignee_user_id) && (() => {
                const buttonField = (cfg?.fields || []).find(f => f.type === 'button');
                if (buttonField) {
                  return (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(buttonField.options || []).map(opt => {
                        const action = actionForOption(opt);
                        const variant = action === 'reject' ? 'destructive' : action === 'revise' ? 'outline' : 'default';
                        return (
                          <Button
                            key={opt}
                            size="sm"
                            variant={variant as any}
                            disabled={busy === step.id}
                            onClick={() => completeStep(step, action, opt)}
                          >
                            {opt}
                          </Button>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="lg"
                      disabled={busy === step.id}
                      onClick={() => completeStep(step)}
                    >
                      {busy === step.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {t('nextStep')}
                    </Button>
                  </div>
                );

              })()}

            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
