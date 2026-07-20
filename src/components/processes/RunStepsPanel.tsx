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

interface Profile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface FieldDef {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'file' | 'user';
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

  const load = async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from('process_run_steps').select('*').eq('run_id', runId).order('sort_order'),
      supabase.from('profiles').select('user_id, name, avatar_url, avatar_color'),
    ]);
    if (sRes.data) setSteps(sRes.data as unknown as Step[]);
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
  };

  const uploadFile = async (stepId: string, fieldId: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/${runId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('process-attachments').upload(path, file);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    setFieldValue(stepId, fieldId, { path, name: file.name });
  };

  const completeStep = async (step: Step) => {
    if (!user) return;
    const cfg = step.step_config;
    const draft = valuesDrafts[step.id] || (step.step_values as any) || {};

    // Validate required
    if (cfg?.fields) {
      for (const f of cfg.fields) {
        if (f.required) {
          const v = draft[f.id];
          const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
          if (empty) {
            toast({
              title: t('fieldRequired') || 'Обовʼязкове поле',
              description: f.label,
              variant: 'destructive',
            });
            return;
          }
        }
      }
    }

    setBusy(step.id);
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
    } else {
      await supabase.from('process_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    }

    await load();
    toast({ title: t('statusUpdated') || 'Крок завершено' });
    setBusy(null);
  };

  const initials = (n?: string) => (n || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const renderField = (step: Step, f: FieldDef) => {
    const draft = valuesDrafts[step.id] || (step.step_values as any) || {};
    const v = draft[f.id];
    const set = (val: any) => setFieldValue(step.id, f.id, val);
    const readOnly = step.status !== 'in_progress';

    switch (f.type) {
      case 'textarea':
        return <Textarea rows={3} value={v || ''} onChange={(e) => set(e.target.value)} disabled={readOnly} />;
      case 'number':
        return <Input type="number" value={v ?? ''} onChange={(e) => set(e.target.value)} disabled={readOnly} />;
      case 'select':
        return (
          <Select value={v || ''} onValueChange={set} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder={t('selectOption') || 'Оберіть...'} /></SelectTrigger>
            <SelectContent>
              {(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={v || ''} onValueChange={set} disabled={readOnly}>
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
          <div className="space-y-1.5">
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(step.id, f.id, file);
                }}
              />
            )}
            {v && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                {typeof v === 'object' ? v.name : String(v).split('/').pop()}
              </div>
            )}
          </div>
        );
      case 'user':
        return (
          <Select value={v || ''} onValueChange={set} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder={t('selectUser') || 'Оберіть користувача'} /></SelectTrigger>
            <SelectContent>
              {Object.values(profiles).map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return <Input value={v || ''} onChange={(e) => set(e.target.value)} disabled={readOnly} />;
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (steps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('processSteps') || 'Кроки процесу'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                  {t('step') || 'Крок'} {idx + 1}
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

              {cfg?.fields && cfg.fields.length > 0 && (active || step.status === 'completed') && (
                <div className="mt-3 space-y-3">
                  {cfg.fields.map((f) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label className="text-xs">
                        {f.label}
                        {f.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {renderField(step, f)}
                    </div>
                  ))}
                </div>
              )}

              {canAct && (
                <div className="mt-4">
                  <Button
                    size="sm"
                    disabled={busy === step.id}
                    onClick={() => completeStep(step)}
                  >
                    {busy === step.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    {t('completeStep') || 'Завершити крок'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
