import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Play, Edit, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, MoreVertical, Trash2, FolderInput, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

interface ProcessType {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface ProcessField {
  id: string;
  name: string;
  field_type: string;
  options: string[] | null;
  sort_order: number;
}

interface ProcessRun {
  id: string;
  field_values: Record<string, unknown>;
  status: string;
  started_at: string;
  started_by: string;
}

interface Process {
  id: string;
  title: string;
  description: string | null;
  type_id: string | null;
  department_id: string | null;
  category_id?: string | null;
  status: string;
  created_by: string;
  created_at: string;
  process_type?: ProcessType;
  department?: Department;
  process_fields?: ProcessField[];
}

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface ProcessCardProps {
  process: Process;
  onEdit: (process: Process) => void;
  categories?: Category[];
  onCategoryChanged?: () => void;
}

export const ProcessCard = ({ process, onEdit, categories = [], onCategoryChanged }: ProcessCardProps) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(true);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const canManage = isAdmin || user?.id === process.created_by;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRuns();
  }, [process.id]);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('processes').delete().eq('id', process.id);
    setDeleting(false);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('deleteProcess'), description: process.title });
    setConfirmOpen(false);
    // Refresh list
    window.dispatchEvent(new CustomEvent('processes:refresh'));
  };

  const fetchRuns = async () => {
    setLoadingRuns(true);
    const { data, error } = await supabase
      .from('process_runs')
      .select('id, field_values, status, started_at, started_by')
      .eq('process_id', process.id)
      .order('started_at', { ascending: false });

    if (!error && data) {
      setRuns(data.map(r => ({
        ...r,
        field_values: r.field_values as Record<string, unknown>,
      })));
    }
    setLoadingRuns(false);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle };
      case 'in_progress':
        return { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Play };
      case 'cancelled':
        return { color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle };
      default:
        return { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: Clock };
    }
  };

  const displayedRuns = showAllRuns ? runs : runs.slice(0, 3);
  const hasMoreRuns = runs.length > 3;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{process.title}</CardTitle>
            {process.department && (
              <Badge variant="secondary" className="w-fit mt-2">{process.department.name}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              size="sm" 
              onClick={() => navigate(`/processes/run/${process.id}`)}
              className="w-auto"
            >
              <Play className="h-4 w-4 mr-1" />
              {t('runProcess')}
            </Button>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(process)}>
                    <Edit className="h-4 w-4 mr-2" />{t('edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />{t('deleteProcess')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProcess')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteProcessConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CardContent className="space-y-4">
        {process.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {process.description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          {process.process_fields && process.process_fields.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {t('fields')}: {process.process_fields.length}
            </div>
          )}
          <Badge variant="outline" className="ml-auto">{process.process_type?.name || t('noType')}</Badge>
        </div>

        {/* Process Runs Section */}
        {runs.length > 0 && (
          <div className="border-t pt-4 mt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {t('processRuns') || 'Запущенные процессы'} ({runs.length})
            </p>
            <div className="space-y-2">
                {displayedRuns.map((run) => {
                const statusConfig = getStatusConfig(run.status);
                const StatusIcon = statusConfig.icon;
                const runName = run.field_values._run_name as string || t('untitled');
                
                const statusLabel = run.status === 'completed' 
                  ? (t('completed') || 'Завершен')
                  : run.status === 'cancelled' 
                  ? (t('cancelled') || 'Отменен')
                  : run.status === 'in_progress'
                  ? (t('inProgress') || 'В работе')
                  : (t('pending') || 'Ожидает');
                
                return (
                  <div 
                    key={run.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/processes/runs/${run.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${run.status === 'completed' ? 'text-green-600' : run.status === 'cancelled' ? 'text-red-600' : run.status === 'in_progress' ? 'text-blue-600' : 'text-yellow-600'}`} />
                      <span className="text-sm font-medium truncate">{runName}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="outline" className={statusConfig.color}>
                        {statusLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(run.started_at), 'd MMM yyyy', { locale: dateLocale })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {hasMoreRuns && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAllRuns(!showAllRuns)}
              >
                {showAllRuns ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    {t('showLess') || 'Свернуть'}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    {t('showMore') || 'Показать ещё'} ({runs.length - 3})
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
