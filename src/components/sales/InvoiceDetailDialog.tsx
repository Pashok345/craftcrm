import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatMoney, INVOICE_STATUS_COLORS } from '@/types/finance';
import type { Invoice, InvoicePayment, DocumentTemplate } from '@/types/finance';
import { generateInvoicePdf } from '@/utils/invoicePdf';
import { InvoiceDialog } from './InvoiceDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}

export const InvoiceDetailDialog = ({ open, onOpenChange, invoice }: Props) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('');

  const { data: payments = [] } = useQuery({
    queryKey: ['invoice-payments', invoice.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data as InvoicePayment[];
    },
    enabled: open,
  });

  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = Math.max(invoice.total_amount - paid, 0);

  const addPayment = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('no user');
      const value = Number(amount);
      const { error } = await supabase.from('invoice_payments').insert({
        invoice_id: invoice.id,
        amount: value,
        paid_at: paidAt,
        method: method || null,
        created_by: uid,
      });
      if (error) throw error;
      const newPaid = paid + value;
      const newStatus = newPaid >= invoice.total_amount ? 'paid' : newPaid > 0 ? 'partial' : invoice.status;
      await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setAmount('');
      setMethod('');
      toast({ title: t('paymentAdded') });
    },
    onError: (e) => toast({ title: t('error'), description: String(e), variant: 'destructive' }),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const handlePdf = async () => {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('doc_type', 'invoice')
      .order('is_default', { ascending: false })
      .limit(1);
    const template = (data?.[0] as unknown as DocumentTemplate | undefined) ?? null;
    await generateInvoicePdf(invoice, invoice.client ?? null, template?.company ?? {}, {
      invoice: t('invoice'),
      number: t('invoiceNumber'),
      issueDate: t('issueDate'),
      dueDate: t('dueDate'),
      supplier: t('supplier'),
      customer: t('customer'),
      itemName: t('itemName'),
      quantity: t('quantity'),
      price: t('price'),
      total: t('total'),
      subtotal: t('subtotal'),
      tax: t('taxRate'),
      grandTotal: t('grandTotal'),
      notes: t('notes'),
      signature: t('signature'),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="pr-12">
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              {t('invoice')} № {invoice.number}
              <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>{t(`invoiceStatus_${invoice.status}`)}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />{t('edit')}
              </Button>
              <Button size="sm" onClick={handlePdf}>
                <Download className="h-4 w-4 mr-1" />{t('downloadPdf')}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('issueDate')}</p>
                <p>{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-xs text-muted-foreground">{t('dueDate')}</p>
                  <p>{format(new Date(invoice.due_date), 'dd.MM.yyyy')}</p>
                </div>
              )}
              {invoice.client && (
                <div>
                  <p className="text-xs text-muted-foreground">{t('client')}</p>
                  <p>{invoice.client.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{t('grandTotal')}</p>
                <p className="font-semibold">{formatMoney(invoice.total_amount, invoice.currency)}</p>
              </div>
            </div>

            {invoice.items?.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('itemName')}</TableHead>
                    <TableHead className="text-right">{t('quantity')}</TableHead>
                    <TableHead className="text-right">{t('price')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.price, invoice.currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.quantity * item.price, invoice.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t('payments')}</span>
                <span className="text-muted-foreground">
                  {formatMoney(paid, invoice.currency)} / {formatMoney(invoice.total_amount, invoice.currency)}
                </span>
              </div>
              <Progress value={invoice.total_amount ? (paid / invoice.total_amount) * 100 : 0} />
              <p className="text-xs text-muted-foreground">{t('remainingAmount')}: {formatMoney(remaining, invoice.currency)}</p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">{t('amount')}</Label>
                  <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('paymentDate')}</Label>
                  <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('paymentMethod')}</Label>
                  <Input value={method} onChange={(e) => setMethod(e.target.value)} />
                </div>
                <Button
                  disabled={!amount || Number(amount) <= 0 || addPayment.isPending}
                  onClick={() => addPayment.mutate()}
                >
                  <Plus className="h-4 w-4 mr-1" />{t('addPayment')}
                </Button>
              </div>

              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{formatMoney(Number(p.amount), invoice.currency)}</span>
                      <span className="text-muted-foreground ml-2">{format(new Date(p.paid_at), 'dd.MM.yyyy')}</span>
                      {p.method && <span className="text-muted-foreground ml-2">· {p.method}</span>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deletePayment.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {invoice.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('notes')}</p>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />
    </>
  );
};
