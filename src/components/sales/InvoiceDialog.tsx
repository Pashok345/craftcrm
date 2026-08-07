import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { calcTotals, formatMoney, CURRENCIES, INVOICE_STATUSES } from '@/types/finance';
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/types/finance';
import type { Client, Deal } from '@/types/sales';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
}

const emptyItem: InvoiceItem = { name: '', description: '', quantity: 1, price: 0 };

export const InvoiceDialog = ({ open, onOpenChange, invoice }: Props) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('__none__');
  const [dealId, setDealId] = useState('__none__');
  const [currency, setCurrency] = useState('UAH');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ ...emptyItem }]);

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
      const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (invoice) {
      setNumber(invoice.number);
      setTitle(invoice.title ?? '');
      setClientId(invoice.client_id ?? '__none__');
      setDealId(invoice.deal_id ?? '__none__');
      setCurrency(invoice.currency);
      setStatus(invoice.status);
      setIssueDate(invoice.issue_date);
      setDueDate(invoice.due_date ?? '');
      setTaxRate(String(invoice.tax_rate ?? 0));
      setNotes(invoice.notes ?? '');
      setItems(invoice.items?.length ? invoice.items : [{ ...emptyItem }]);
    } else {
      setNumber(`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
      setTitle('');
      setClientId('__none__');
      setDealId('__none__');
      setCurrency('UAH');
      setStatus('draft');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setDueDate('');
      setTaxRate('0');
      setNotes('');
      setItems([{ ...emptyItem }]);
    }
  }, [open, invoice]);

  const totals = calcTotals(items, Number(taxRate));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('no user');

      const payload = {
        number: number.trim(),
        title: title.trim() || null,
        client_id: clientId === '__none__' ? null : clientId,
        deal_id: dealId === '__none__' ? null : dealId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: items.filter((i) => i.name.trim()) as any,
        subtotal: totals.subtotal,
        tax_rate: Number(taxRate) || 0,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount,
        currency,
        status,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      };

      if (invoice) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', invoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('invoices').insert({ ...payload, created_by: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: invoice ? t('invoiceUpdated') : t('invoiceCreated') });
      onOpenChange(false);
    },
    onError: (e) => toast({ title: t('error'), description: String(e), variant: 'destructive' }),
  });

  const updateItem = (index: number, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="pr-12">
          <DialogTitle>{invoice ? t('editInvoice') : t('newInvoice')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('invoiceNumber')} *</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('invoiceSubject')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('client')}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('deal')}</Label>
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('issueDate')}</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('dueDate')}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`invoiceStatus_${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('invoiceItems')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, { ...emptyItem }])}>
                <Plus className="h-4 w-4 mr-1" />{t('addItem')}
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start rounded-lg border p-3">
                  <div className="col-span-12 sm:col-span-5 space-y-2">
                    <Input
                      placeholder={t('itemName')}
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                    />
                    <Input
                      placeholder={t('description')}
                      value={item.description ?? ''}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('quantity')}
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={t('price')}
                      value={item.price}
                      onChange={(e) => updateItem(i, { price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1">
                    <span className="text-xs text-muted-foreground truncate">
                      {formatMoney(item.quantity * item.price, currency)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('taxRate')} (%)</Label>
              <Input type="number" min={0} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('subtotal')}</span><span>{formatMoney(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('taxAmount')}</span><span>{formatMoney(totals.tax_amount, currency)}</span></div>
              <div className="flex justify-between font-semibold"><span>{t('grandTotal')}</span><span>{formatMoney(totals.total_amount, currency)}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button disabled={!number.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
