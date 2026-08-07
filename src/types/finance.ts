import type { Client, Deal } from './sales';

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  number: string;
  title?: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  proposal_id?: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  deal?: Deal | null;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  method?: string | null;
  note?: string | null;
  created_by: string;
  created_at: string;
}

export interface DocumentTemplateCompany {
  name?: string;
  tin?: string;
  iban?: string;
  bank?: string;
  address?: string;
  phone?: string;
  email?: string;
  director?: string;
  footer?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  doc_type: 'invoice' | 'proposal' | 'act';
  company: DocumentTemplateCompany;
  settings: Record<string, unknown>;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  partial: 'bg-crm-warning/10 text-crm-warning',
  paid: 'bg-crm-success/10 text-crm-success',
  overdue: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled',
];

export const CURRENCIES = ['UAH', 'USD', 'EUR', 'PLN'] as const;

export const formatMoney = (amount: number, currency = 'UAH') =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

export const calcTotals = (items: InvoiceItem[], taxRate: number) => {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);
  const tax_amount = +(subtotal * ((Number(taxRate) || 0) / 100)).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), tax_amount, total_amount: +(subtotal + tax_amount).toFixed(2) };
};

export const isOverdue = (invoice: Invoice, paid: number) =>
  !!invoice.due_date &&
  invoice.status !== 'paid' &&
  invoice.status !== 'cancelled' &&
  paid < invoice.total_amount &&
  new Date(invoice.due_date) < new Date(new Date().toDateString());
