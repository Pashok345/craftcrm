import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { Proposal, ProposalItem, Client, Deal } from '@/types/sales';

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: Proposal;
}

export const ProposalDialog = ({ open, onOpenChange, proposal }: ProposalDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [dealId, setDealId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState<'draft' | 'sent' | 'accepted' | 'rejected'>('draft');
  const [items, setItems] = useState<ProposalItem[]>([{ name: '', description: '', quantity: 1, price: 0 }]);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('*').order('title');
      if (error) throw error;
      return data as Deal[];
    },
  });

  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title);
      setClientId(proposal.client_id || '');
      setDealId(proposal.deal_id || '');
      setValidUntil(proposal.valid_until || '');
      setStatus(proposal.status);
      setItems(proposal.content.length > 0 ? proposal.content : [{ name: '', description: '', quantity: 1, price: 0 }]);
    } else {
      resetForm();
    }
  }, [proposal, open]);

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const proposalData = {
        title,
        client_id: clientId || null,
        deal_id: dealId || null,
        content: items.filter((i) => i.name.trim()),
        total_amount: totalAmount,
        status,
        valid_until: validUntil || null,
        created_by: user?.id,
      };

      if (proposal) {
        const { error } = await supabase
          .from('proposals')
          .update(proposalData)
          .eq('id', proposal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('proposals').insert(proposalData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({
        title: proposal ? t('proposalUpdated') : t('proposalCreated'),
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
    setClientId('');
    setDealId('');
    setValidUntil('');
    setStatus('draft');
    setItems([{ name: '', description: '', quantity: 1, price: 0 }]);
  };

  const addItem = () => {
    setItems([...items, { name: '', description: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ProposalItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-10">
          <DialogTitle>{proposal ? t('editProposal') : t('createProposal')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('proposalTitle')} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('enterProposalTitle')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('client')}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('noClient')}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('deal')}</Label>
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectDeal')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('noDeal')}</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('validUntil')}</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('proposalDraft')}</SelectItem>
                  <SelectItem value="sent">{t('proposalSent')}</SelectItem>
                  <SelectItem value="accepted">{t('proposalAccepted')}</SelectItem>
                  <SelectItem value="rejected">{t('proposalRejected')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('proposalItems')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                {t('addItem')}
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <Input
                    placeholder={t('itemName')}
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className="col-span-2"
                  />
                  <Input
                    type="number"
                    placeholder={t('quantity')}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    min={1}
                  />
                  <Input
                    type="number"
                    placeholder={t('price')}
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-end text-lg font-medium">
              {t('total')}: {formatCurrency(totalAmount)}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {proposal ? t('save') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
