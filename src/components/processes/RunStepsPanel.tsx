import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle, RotateCcw, Clock, Play, Flag, GitBranch, Zap, UserCheck, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Step {
  id: string;
  run_id: string;
  step_id: string;
  step_type: string;
  step_label: string | null;
  assignee_id: string | null;
  status: string;
  comment: string | null;
  sla_deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  sort_order: number;
}

interface Profile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  start: { icon: Play, color: '#22c55e', label: 'Початок' },
  task: { icon: FileText, color: '#3b82f6', label: 'Задача' },
  approval: { icon: UserCheck, color: '#a855f7', label: 'Погодження' },
  condition: { icon: GitBranch, color: '#f59e0b', label: 'Умова' },
  action: { icon: Zap, color: '#06b6d4', label: 'Дія' },
  end: { icon: Flag, color: '#ef4444', label: 'Кінець' },
};

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  approved: 'bg-green-500/10 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/30',
  returned: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
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
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from('process_run_steps').select('*').eq('run_id', runId).order('sort_order'),
      supabase.from('profiles').select('user_id, name, avatar_url, avatar_color'),
    ]);
    if (sRes.data) setSteps(sRes.data as Step[]);
    if (pRes.data) {
      const m: Record<string, Profile> = {};
      pRes.data.forEach((p: any) => { m[p.user_id] = p; });
      setProfiles(m);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [runId]);

  const advanceRun = async () => {
    // If all steps completed/approved -> mark run completed
    const { data: fresh } = await supabase.from('process_run_steps').select('status').eq('run_id', runId);
    if (fresh && fresh.every((s: any) => s.status === 'approved' || s.status === 'completed' || s.status === 'rejected')) {
      const anyRejected = fresh.some((s: any) => s.status === 'rejected');
      await supabase.from('process_runs').update({
        status: anyRejected ? 'cancelled' : 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
    } else {
      await supabase.from('process_runs').update({ status: 'in_progress' }).eq('id', runId);
    }
  };

  const activateNext = async (afterSortOrder: number, currentSteps: Step[]) => {
    // Find & activate next pending step; if it's condition/action, auto-execute and continue.
    let cursor = afterSortOrder;
    // work on a mutable copy so subsequent iterations see updates
    const work = [...currentSteps];
    while (true) {
      const next = work.find(s => s.sort_order > cursor && s.status === 'pending');
      if (!next) return;
      await supabase.from('process_run_steps').update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      }).eq('id', next.id);
      await supabase.from('process_runs').update({ current_step_id: next.step_id }).eq('id', runId);

      if (next.step_type === 'condition' || next.step_type === 'action') {
        // Auto-execute: mark completed with a system note
        const note =
          next.step_type === 'condition'
            ? 'Автовиконання: умова прийнята за замовчуванням'
            : 'Автовиконання: дію виконано';
        await supabase.from('process_run_steps').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          comment: note,
        }).eq('id', next.id);
        const idx = work.findIndex(s => s.id === next.id);
        if (idx >= 0) work[idx] = { ...work[idx], status: 'completed' };
        cursor = next.sort_order;
        continue;
      }
      return;
    }
  };

  const act = async (step: Step, newStatus: 'approved' | 'rejected' | 'returned' | 'completed') => {
    if (!user) return;
    setBusy(step.id);
    const patch: any = {
      status: newStatus,
      comment: commentDrafts[step.id] || step.comment || null,
    };
    if (!step.started_at) patch.started_at = new Date().toISOString();
    if (newStatus !== 'returned') patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from('process_run_steps').update(patch).eq('id', step.id);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } else {
      if (newStatus === 'approved' || newStatus === 'completed') {
        await activateNext(step.sort_order, steps);
      }
      await advanceRun();
      await load();
      toast({ title: t('statusUpdated') });
    }
    setBusy(null);
  };


  const initials = (n?: string) => (n || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

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
      <CardContent className="space-y-3">
        {steps.map((step, idx) => {
          const meta = TYPE_META[step.step_type] || TYPE_META.task;
          const Icon = meta.icon;
          const assignee = step.assignee_id ? profiles[step.assignee_id] : null;
          const canAct = user && (user.id === step.assignee_id || (user.id === initiatorId && step.status === 'in_progress'));
          const active = step.status === 'in_progress' || step.status === 'pending';
          const overdue = step.sla_deadline && new Date(step.sla_deadline) < new Date() && active;
          return (
            <div
              key={step.id}
              className="border rounded-lg p-3 transition-colors"
              style={{ borderColor: active ? meta.color : undefined, borderLeftWidth: 4, borderLeftColor: meta.color }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" style={{ color: meta.color, borderColor: `${meta.color}80` }}>
                  <Icon className="h-3 w-3 mr-1" />{idx + 1}. {step.step_label || meta.label}
                </Badge>
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

              {step.sla_deadline && (
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  SLA: {format(new Date(step.sla_deadline), 'dd.MM.yyyy HH:mm')}
                </div>
              )}

              {step.comment && (
                <div className="text-sm mt-2 p-2 rounded bg-muted/40">{step.comment}</div>
              )}

              {canAct && active && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    rows={2}
                    placeholder={t('commentOptional') || 'Коментар (необовʼязково)'}
                    value={commentDrafts[step.id] ?? ''}
                    onChange={(e) => setCommentDrafts(d => ({ ...d, [step.id]: e.target.value }))}
                  />
                  <div className="flex gap-2 flex-wrap">
                    {step.step_type === 'approval' ? (
                      <>
                        <Button size="sm" disabled={busy === step.id} onClick={() => act(step, 'approved')} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />{t('approve') || 'Погодити'}
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy === step.id} onClick={() => act(step, 'rejected')}>
                          <XCircle className="h-4 w-4 mr-1" />{t('reject') || 'Відхилити'}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === step.id} onClick={() => act(step, 'returned')}>
                          <RotateCcw className="h-4 w-4 mr-1" />{t('returnStep') || 'На доопрацювання'}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" disabled={busy === step.id} onClick={() => act(step, 'completed')}>
                        <CheckCircle className="h-4 w-4 mr-1" />{t('completeStep') || 'Завершити крок'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
