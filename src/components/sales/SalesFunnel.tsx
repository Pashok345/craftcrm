import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, Calendar, Building2, Settings2, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DealDialog } from './DealDialog';
import { DealDetailDialog } from './DealDetailDialog';
import { StageDialog } from './StageDialog';
import type { Deal, DealStage, Client } from '@/types/sales';

export const SalesFunnel = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<DealStage | undefined>(undefined);

  const { data: stages = [] } = useQuery({
    queryKey: ['deal-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as DealStage[];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          client:clients(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (Deal & { client: Client | null })[];
    },
  });

  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({ stage_id: stageId })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const reorderStagesMutation = useMutation({
    mutationFn: async (reorderedStages: { id: string; sort_order: number }[]) => {
      for (const stage of reorderedStages) {
        const { error } = await supabase
          .from('deal_stages')
          .update({ sort_order: stage.sort_order })
          .eq('id', stage.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({ title: t('stagesReordered') });
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    // Handle stage reordering
    if (type === 'STAGE') {
      const reordered = Array.from(stages);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);

      const updates = reordered.map((stage, index) => ({
        id: stage.id,
        sort_order: index,
      }));

      reorderStagesMutation.mutate(updates);
      return;
    }

    // Handle deal movement between stages
    const dealId = result.draggableId;
    const newStageId = destination.droppableId;

    updateDealStageMutation.mutate({ dealId, stageId: newStageId });
  };

  const getDealsByStage = (stageId: string) => {
    return deals.filter((deal) => deal.stage_id === stageId);
  };

  const getStageTotal = (stageId: string) => {
    return getDealsByStage(stageId).reduce((sum, deal) => sum + (deal.amount || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{t('totalDeals')}: {deals.length}</span>
          <span>{t('totalAmount')}: {formatCurrency(deals.reduce((sum, d) => sum + (d.amount || 0), 0))}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            setSelectedStage(undefined);
            setStageDialogOpen(true);
          }}>
            <Settings2 className="h-4 w-4 mr-2" />
            {t('addStage')}
          </Button>
          <Button onClick={() => setDealDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addDeal')}
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                      onClick={() => {
                        setSelectedStage(stage);
                        setStageDialogOpen(true);
                      }}
                      title={t('editStage')}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <CardTitle className="text-sm font-medium">
                        {stage.name}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {getDealsByStage(stage.id).length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(getStageTotal(stage.id))}
                  </p>
                </CardHeader>
                <CardContent className="p-2">
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'min-h-[200px] space-y-2 p-1 rounded-lg transition-colors',
                          snapshot.isDraggingOver && 'bg-muted/50'
                        )}
                      >
                        {getDealsByStage(stage.id).map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  'p-3 bg-card border rounded-lg cursor-pointer hover:shadow-md transition-shadow',
                                  snapshot.isDragging && 'shadow-lg'
                                )}
                                onClick={() => {
                                  setSelectedDeal(deal);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                <h4 className="font-medium text-sm mb-2 line-clamp-2">
                                  {deal.title}
                                </h4>
                                
                                {deal.client && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                    <Building2 className="h-3 w-3" />
                                    <span className="truncate">{deal.client.name}</span>
                                  </div>
                                )}
                                
                                {deal.amount && (
                                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(deal.amount)}
                                  </div>
                                )}
                                
                                {deal.expected_close_date && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(deal.expected_close_date), 'd MMM', { locale: ru })}
                                  </div>
                                )}

                                {deal.probability !== undefined && deal.probability !== null && (
                                  <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-muted-foreground">{t('probability')}</span>
                                      <span>{deal.probability}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${deal.probability}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </DragDropContext>

      <DealDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        stages={stages}
      />

      {selectedDeal && (
        <DealDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          deal={selectedDeal}
          stages={stages}
        />
      )}

      <StageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        stage={selectedStage}
        maxSortOrder={Math.max(...stages.map(s => s.sort_order), 0)}
      />
    </div>
  );
};
