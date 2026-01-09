import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

interface ProcessRun {
  id: string;
  field_values: unknown;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
}

interface ProcessRunsDialogProps {
  open: boolean;
  onOpenChange: () => void;
  process: { id: string; title: string };
}

export const ProcessRunsDialog = ({
  open,
  onOpenChange,
  process,
}: ProcessRunsDialogProps) => {
  const { t, language } = useLanguage();
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (open) {
      fetchRuns();
    }
  }, [open, process.id]);

  const fetchRuns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('process_runs')
      .select('*')
      .eq('process_id', process.id)
      .order('started_at', { ascending: false });
    
    if (data) setRuns(data);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-600';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'cancelled':
        return 'bg-red-500/10 text-red-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {t('processRuns')}: {process.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('noProcessRuns')}
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(run.started_at), 'dd MMM yyyy, HH:mm', {
                        locale: dateLocale,
                      })}
                    </span>
                    <Badge className={getStatusColor(run.status)}>
                      {t(`status_${run.status}`) || run.status}
                    </Badge>
                  </div>
                  {run.field_values && typeof run.field_values === 'object' && Object.keys(run.field_values as Record<string, unknown>).length > 0 && (
                    <div className="text-sm space-y-1">
                      {Object.entries(run.field_values as Record<string, unknown>).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium">{key}:</span>
                          <span className="text-muted-foreground">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
