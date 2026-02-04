import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Calendar, Building2, Percent, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DealDialog } from './DealDialog';
import { DealCommentsSection } from './DealCommentsSection';
import type { Deal, DealStage } from '@/types/sales';

interface DealDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  stages: DealStage[];
}

export const DealDetailDialog = ({
  open,
  onOpenChange,
  deal,
  stages,
}: DealDetailDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const stage = stages.find((s) => s.id === deal.stage_id);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('deals').delete().eq('id', deal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: t('dealDeleted') });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center gap-3">
              {deal.title}
              {stage && (
                <Badge style={{ backgroundColor: stage.color, color: 'white' }}>
                  {stage.name}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {deal.amount && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('amount')}</p>
                    <p className="font-medium">{formatCurrency(deal.amount)}</p>
                  </div>
                </div>
              )}

              {deal.probability !== undefined && (
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('probability')}</p>
                    <p className="font-medium">{deal.probability}%</p>
                  </div>
                </div>
              )}

              {deal.expected_close_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('expectedCloseDate')}</p>
                    <p className="font-medium">
                      {format(new Date(deal.expected_close_date), 'd MMMM yyyy', { locale: ru })}
                    </p>
                  </div>
                </div>
              )}

              {deal.client && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('client')}</p>
                    <p className="font-medium">{deal.client.name}</p>
                  </div>
                </div>
              )}
            </div>

            {deal.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('description')}</p>
                <p className="text-sm whitespace-pre-wrap">{deal.description}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DealDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        stages={stages}
        deal={deal}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDeal')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDealConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
