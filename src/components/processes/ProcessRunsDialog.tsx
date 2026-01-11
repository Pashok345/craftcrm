import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, ChevronRight, Clock, Play, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

interface ProcessRun {
  id: string;
  field_values: Record<string, unknown>;
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
  const navigate = useNavigate();
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
    
    if (data) {
      setRuns(data.map(r => ({
        ...r,
        field_values: r.field_values as Record<string, unknown>
      })));
    }
    setLoading(false);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle, label: t('status_completed') };
      case 'in_progress':
        return { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Play, label: t('status_in_progress') };
      case 'cancelled':
        return { color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle, label: t('status_cancelled') };
      default:
        return { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: Clock, label: t('status_pending') };
    }
  };

  const handleRunClick = (runId: string) => {
    onOpenChange();
    navigate(`/processes/runs/${runId}`);
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
            <div className="space-y-2">
              {runs.map((run) => {
                const statusConfig = getStatusConfig(run.status);
                const StatusIcon = statusConfig.icon;
                const runName = run.field_values._run_name as string || t('untitled');
                
                return (
                  <div
                    key={run.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors flex items-center gap-3"
                    onClick={() => handleRunClick(run.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{runName}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(run.started_at), 'dd MMM yyyy, HH:mm', {
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                    <Badge className={`${statusConfig.color} border shrink-0`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
