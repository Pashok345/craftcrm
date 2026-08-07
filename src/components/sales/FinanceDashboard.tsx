import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Banknote, Hourglass, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { formatMoney, isOverdue } from '@/types/finance';
import type { Invoice, InvoicePayment } from '@/types/finance';
import type { Client } from '@/types/sales';

export const FinanceDashboard = () => {
  const { t } = useLanguage();

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any[]).map((i) => ({ ...i, items: Array.isArray(i.items) ? i.items : [] })) as (Invoice & {
        client: Client | null;
      })[];
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

  const currency = invoices[0]?.currency ?? 'UAH';
  const invoiced = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const received = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const awaiting = Math.max(invoiced - received, 0);
  const overdueInvoices = invoices.filter((i) => isOverdue(i, paidByInvoice[i.id] || 0));
  const overdueAmount = overdueInvoices.reduce(
    (s, i) => s + (Number(i.total_amount || 0) - (paidByInvoice[i.id] || 0)),
    0,
  );

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, idx) => startOfMonth(subMonths(new Date(), 5 - idx)));
    return months.map((m) => {
      const key = format(m, 'yyyy-MM');
      const inv = invoices
        .filter((i) => i.status !== 'cancelled' && i.issue_date?.slice(0, 7) === key)
        .reduce((s, i) => s + Number(i.total_amount || 0), 0);
      const pay = payments
        .filter((p) => p.paid_at?.slice(0, 7) === key)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      return { name: format(m, 'MM.yyyy'), invoiced: +inv.toFixed(2), received: +pay.toFixed(2) };
    });
  }, [invoices, payments]);

  const kpis = [
    { label: t('totalInvoiced'), value: formatMoney(invoiced, currency), icon: Banknote, tone: 'bg-primary/10 text-primary' },
    { label: t('totalReceived'), value: formatMoney(received, currency), icon: Wallet, tone: 'bg-crm-success/10 text-crm-success' },
    { label: t('awaitingPayment'), value: formatMoney(awaiting, currency), icon: Hourglass, tone: 'bg-crm-warning/10 text-crm-warning' },
    { label: t('overduePayments'), value: formatMoney(overdueAmount, currency), icon: AlertTriangle, tone: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.tone}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold truncate">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('revenueByMonth')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => formatMoney(value, currency)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Bar dataKey="invoiced" name={t('totalInvoiced')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="received" name={t('totalReceived')} fill="hsl(var(--crm-success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t('overdueInvoices')}
            <Badge variant="secondary">{overdueInvoices.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noOverdueInvoices')}</p>
          ) : (
            <div className="space-y-2">
              {overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">№ {inv.number} · {inv.client?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('dueDate')}: {inv.due_date ? format(new Date(inv.due_date), 'dd.MM.yyyy') : '—'}
                    </p>
                  </div>
                  <span className="font-semibold text-destructive whitespace-nowrap">
                    {formatMoney(Number(inv.total_amount) - (paidByInvoice[inv.id] || 0), inv.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
