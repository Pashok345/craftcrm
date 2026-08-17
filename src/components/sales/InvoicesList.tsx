import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatMoney, INVOICE_STATUS_COLORS, INVOICE_STATUSES, isOverdue } from '@/types/finance';
import type { Invoice, InvoicePayment } from '@/types/finance';
import type { Client, Deal } from '@/types/sales';
import { InvoiceDialog } from './InvoiceDialog';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { DocumentTemplatesDialog } from './DocumentTemplatesDialog';
import { ExportMenu } from '@/components/common/ExportMenu';

export const InvoicesList = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(*), deal:deals(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any[]).map((i) => ({
        ...i,
        items: Array.isArray(i.items) ? i.items : [],
      })) as (Invoice & { client: Client | null; deal: Deal | null })[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['invoice-payments-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_payments').select('*');
      if (error) throw error;
      return data as InvoicePayment[];
    },
  });

  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => {
      map[p.invoice_id] = (map[p.invoice_id] || 0) + Number(p.amount || 0);
    });
    return map;
  }, [payments]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: t('invoiceDeleted') });
    },
  });

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      inv.number.toLowerCase().includes(q) ||
      (inv.title ?? '').toLowerCase().includes(q) ||
      (inv.client?.name ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-1 gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t('searchInvoices')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`invoiceStatus_${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            filename="invoices"
            rows={filtered}
            columns={[
              { key: 'number', header: t('invoiceNumber'), value: (i) => i.number },
              { key: 'title', header: t('title'), value: (i) => i.title || '' },
              { key: 'client', header: t('client'), value: (i) => i.client?.name || '' },
              { key: 'status', header: t('status'), value: (i) => t(`invoiceStatus_${i.status}`) },
              { key: 'total', header: t('total'), value: (i) => Number(i.total_amount || 0) },
              { key: 'currency', header: t('currency'), value: (i) => i.currency },
              { key: 'paid', header: t('paid'), value: (i) => paidByInvoice[i.id] || 0 },
              { key: 'issue_date', header: t('issueDate'), value: (i) => i.issue_date || '' },
              { key: 'due_date', header: t('dueDate'), value: (i) => i.due_date || '' },
            ]}
          />
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />{t('documentTemplates')}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('newInvoice')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-50" />
            {t('noInvoices')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const paid = paidByInvoice[inv.id] || 0;
            const overdue = isOverdue(inv, paid);
            return (
              <Card
                key={inv.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(inv)}
              >
                <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">№ {inv.number}</span>
                      <Badge className={INVOICE_STATUS_COLORS[inv.status]}>{t(`invoiceStatus_${inv.status}`)}</Badge>
                      {overdue && <Badge variant="destructive">{t('overdue')}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {inv.client?.name ?? '—'}{inv.title ? ` · ${inv.title}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(inv.total_amount, inv.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('paid')}: {formatMoney(paid, inv.currency)}
                        {inv.due_date ? ` · ${format(new Date(inv.due_date), 'dd.MM.yyyy')}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(inv.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <InvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DocumentTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      {selected && (
        <InvoiceDetailDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          invoice={selected}
        />
      )}
    </div>
  );
};
