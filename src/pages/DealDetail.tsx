import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { ArrowLeft, Building2, Calendar, DollarSign, Pencil, Percent, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DealCommentsSection } from '@/components/sales/DealCommentsSection';
import type { Client, Deal, DealStage } from '@/types/sales';

const DealDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, client:clients(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as (Deal & { client: Client | null }) | null;
    },
    enabled: !!id,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ['deal-stages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deal_stages').select('*').order('sort_order');
      if (error) throw error;
      return data as DealStage[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('deals').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: t('dealDeleted') });
      navigate('/sales');
    },
    onError: () => toast({ title: t('error'), variant: 'destructive' }),
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToSales') || 'Назад'}
        </Button>
        <p className="text-muted-foreground">{t('dealNotFound') || 'Сделка не найдена'}</p>
      </div>
    );
  }

  const stage = stages.find((s) => s.id === deal.stage_id);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToSales') || 'Назад'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/sales/deals/${deal.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-1" />
            {t('edit')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />
            {t('delete')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            {stage && (
              <Badge style={{ backgroundColor: stage.color, color: 'white' }}>{stage.name}</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {deal.amount != null && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('amount')}</p>
                  <p className="font-medium">{formatCurrency(deal.amount)}</p>
                </div>
              </div>
            )}
            {deal.probability != null && (
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
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">{t('description')}</p>
              <p className="text-sm whitespace-pre-wrap">{deal.description}</p>
            </div>
          )}

          <Separator />

          <DealCommentsSection dealId={deal.id} />
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
    </div>
  );
};

export default DealDetail;
