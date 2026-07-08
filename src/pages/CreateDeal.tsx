import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { ArrowLeft } from 'lucide-react';
import type { Client, Deal, DealStage } from '@/types/sales';

const CreateDeal = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = Boolean(id);

  const { data: stages = [] } = useQuery({
    queryKey: ['deal-stages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deal_stages').select('*').order('sort_order');
      if (error) throw error;
      return data as DealStage[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: existing } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Deal | null;
    },
    enabled: isEdit,
  });

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [clientId, setClientId] = useState('');
  const [stageId, setStageId] = useState('');
  const [probability, setProbability] = useState(50);
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!stageId && stages.length && !isEdit) setStageId(stages[0].id);
  }, [stages, stageId, isEdit]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title || '');
      setAmount(existing.amount?.toString() || '');
      setClientId(existing.client_id || '');
      setStageId(existing.stage_id || '');
      setProbability(existing.probability ?? 50);
      setExpectedCloseDate(existing.expected_close_date || '');
      setDescription(existing.description || '');
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const dealData: any = {
        title,
        amount: amount ? parseFloat(amount) : null,
        client_id: clientId || null,
        stage_id: stageId,
        probability,
        expected_close_date: expectedCloseDate || null,
        description: description || null,
      };
      if (isEdit && id) {
        const { error } = await supabase.from('deals').update(dealData).eq('id', id);
        if (error) throw error;
        return id;
      } else {
        dealData.created_by = user?.id;
        const { data, error } = await supabase.from('deals').insert(dealData).select('id').single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', newId] });
      toast({ title: isEdit ? t('dealUpdated') : t('dealCreated') });
      navigate(`/sales/deals/${newId}`);
    },
    onError: () => toast({ title: t('error'), variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !stageId) return;
    mutation.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToSales') || 'Назад'}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{isEdit ? t('editDeal') : t('addDeal')}</h1>
      </div>

      <Card>
        <CardContent className="p-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('client')}</Label>
                <Select
                  value={clientId || '__none__'}
                  onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}
                >
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
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {isEdit ? t('save') : t('create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateDeal;
