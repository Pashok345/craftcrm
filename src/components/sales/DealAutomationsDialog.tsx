import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Zap } from 'lucide-react';
import type { DealStageAutomation } from '@/lib/dealAutomation';
import type { DealStage } from '@/types/sales';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: DealStage[];
}

interface ProfileMini {
  user_id: string;
  name: string | null;
}

const NONE = '__none__';

export const DealAutomationsDialog = ({ open, onOpenChange, stages }: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [rules, setRules] = useState<DealStageAutomation[]>([]);
  const [profiles, setProfiles] = useState<ProfileMini[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stageId, setStageId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(NONE);
  const [dueInDays, setDueInDays] = useState('3');

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('deal_stage_automations').select('*').order('created_at', { ascending: false }),
      supabase.from('public_profiles').select('user_id, name'),
    ]);
    setRules((r || []) as unknown as DealStageAutomation[]);
    setProfiles((p || []) as ProfileMini[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const add = async () => {
    if (!user || !stageId || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('deal_stage_automations').insert({
      stage_id: stageId,
      task_title: title.trim(),
      task_description: description.trim() || null,
      assignee_id: assigneeId === NONE ? null : assigneeId,
      due_in_days: Math.max(0, parseInt(dueInDays, 10) || 0),
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('automationCreated') });
    setTitle('');
    setDescription('');
    setAssigneeId(NONE);
    setDueInDays('3');
    load();
  };

  const toggle = async (rule: DealStageAutomation) => {
    await supabase.from('deal_stage_automations').update({ is_active: !rule.is_active }).eq('id', rule.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('deal_stage_automations').delete().eq('id', id);
    toast({ title: t('automationDeleted') });
    load();
  };

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name || '—';
  const personName = (id: string | null) => profiles.find((p) => p.user_id === id)?.name || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t('dealAutomations')}
          </DialogTitle>
          <DialogDescription>{t('dealAutomationsDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('automationStage')}</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder={t('automationStage')} /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('automationAssignee')}</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.user_id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('automationTaskTitle')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="{deal}" />
              <p className="text-xs text-muted-foreground">{t('automationHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('automationTaskDescription')}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" />
            </div>

            <div className="flex items-end gap-3">
              <div className="space-y-1.5 w-32">
                <Label>{t('automationDueInDays')}</Label>
                <Input type="number" min={0} value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} />
              </div>
              <Button onClick={add} disabled={saving || !stageId || !title.trim()} className="ml-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {t('automationAdd')}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{t('automationEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{stageName(r.stage_id)}</Badge>
                      <span className="font-medium truncate">{r.task_title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {t('automationAssignee')}: {personName(r.assignee_id)} · {t('automationDueInDays')}: {r.due_in_days}
                    </p>
                  </div>
                  <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
