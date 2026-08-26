import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, AlertTriangle, ListChecks, RefreshCw, Check } from 'lucide-react';

interface Insights {
  summary: string;
  next_steps: string[];
  risks: string[];
  win_probability: number | null;
  probability_reason: string;
  suggested_fields?: { expected_close_date?: string | null; amount?: number | null } | null;
}

interface Props {
  entityType: 'deal' | 'client';
  entityId: string;
}

export const AIInsightsPanel = ({ entityType, entityId }: Props) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [insights, setInsights] = useState<Insights | null>(null);

  const analyze = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sales-ai-insights', {
        body: { entity_type: entityType, entity_id: entityId, language },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as Insights;
    },
    onSuccess: (data) => setInsights(data),
    onError: (e: any) =>
      toast({ title: e?.message || t('aiInsightsError'), variant: 'destructive' }),
  });

  const applyFields = useMutation({
    mutationFn: async () => {
      if (entityType !== 'deal' || !insights) return;
      const patch: Record<string, unknown> = {};
      if (insights.win_probability != null) patch.probability = insights.win_probability;
      const d = insights.suggested_fields?.expected_close_date;
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) patch.expected_close_date = d;
      if (!Object.keys(patch).length) return;
      const { error } = await supabase.from('deals').update(patch).eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', entityId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: t('aiFieldsApplied') });
    },
    onError: () => toast({ title: t('error'), variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-medium">{t('aiAssistantSales')}</h3>
        </div>
        <Button size="sm" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
          {analyze.isPending ? (
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {insights ? t('aiReanalyze') : t('aiAnalyze')}
        </Button>
      </div>

      {!insights && !analyze.isPending && (
        <p className="text-sm text-muted-foreground">{t('aiInsightsHint')}</p>
      )}

      {insights && (
        <div className="space-y-4">
          {insights.win_probability != null && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('aiWinProbability')}</span>
                <Badge variant="secondary">{insights.win_probability}%</Badge>
              </div>
              <Progress value={insights.win_probability} />
              {insights.probability_reason && (
                <p className="text-xs text-muted-foreground">{insights.probability_reason}</p>
              )}
              {entityType === 'deal' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyFields.mutate()}
                  disabled={applyFields.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('aiApplyFields')}
                </Button>
              )}
            </div>
          )}

          {insights.summary && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">{t('aiSummary')}</p>
              <p className="text-sm whitespace-pre-wrap">{insights.summary}</p>
            </div>
          )}

          {insights.next_steps.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ListChecks className="h-3 w-3" /> {t('aiNextSteps')}
              </p>
              <ul className="space-y-1 text-sm list-disc pl-5">
                {insights.next_steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {insights.risks.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t('aiRisks')}
              </p>
              <ul className="space-y-1 text-sm list-disc pl-5">
                {insights.risks.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
