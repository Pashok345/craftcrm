import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { DealStage, Client, Deal } from '@/types/sales';

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: DealStage[];
  deal?: Deal;
}

export const DealDialog = ({ open, onOpenChange, stages, deal }: DealDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(deal?.title || '');
  const [amount, setAmount] = useState(deal?.amount?.toString() || '');
  const [clientId, setClientId] = useState(deal?.client_id || '');
  const [stageId, setStageId] = useState(deal?.stage_id || stages[0]?.id || '');
  const [probability, setProbability] = useState(deal?.probability || 50);
  const [expectedCloseDate, setExpectedCloseDate] = useState(deal?.expected_close_date || '');
  const [description, setDescription] = useState(deal?.description || '');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const dealData = {
        title,
        amount: amount ? parseFloat(amount) : null,
        client_id: clientId || null,
        stage_id: stageId,
        probability,
        expected_close_date: expectedCloseDate || null,
        description: description || null,
        created_by: user?.id,
      };

      if (deal) {
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', deal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('deals').insert(dealData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: deal ? t('dealUpdated') : t('dealCreated'),
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setClientId('');
    setStageId(stages[0]?.id || '');
    setProbability(50);
    setExpectedCloseDate('');
    setDescription('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !stageId) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-10">
          <DialogTitle>{deal ? t('editDeal') : t('addDeal')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('dealTitle')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('enterDealTitle')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('amount')}</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('expectedCloseDate')}</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('client')}</Label>
          <Select value={clientId || '__none__'} onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectClient')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('noClient')}</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('stage')}</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>{t('probability')}</Label>
              <span className="text-sm text-muted-foreground">{probability}%</span>
            </div>
            <Slider
              value={[probability]}
              onValueChange={([val]) => setProbability(val)}
              max={100}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dealDescriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {deal ? t('save') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
