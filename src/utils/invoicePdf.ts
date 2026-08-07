import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { loadRobotoFontBase64 } from '@/utils/fontBase64';
import { formatMoney } from '@/types/finance';
import type { Invoice, DocumentTemplateCompany } from '@/types/finance';
import type { Client } from '@/types/sales';

interface PdfLabels {
  invoice: string;
  number: string;
  issueDate: string;
  dueDate: string;
  supplier: string;
  customer: string;
  itemName: string;
  quantity: string;
  price: string;
  total: string;
  subtotal: string;
  tax: string;
  grandTotal: string;
  notes: string;
  signature: string;
}

export const generateInvoicePdf = async (
  invoice: Invoice,
  client: Client | null | undefined,
  company: DocumentTemplateCompany,
  labels: PdfLabels,
) => {
  const doc = new jsPDF();
  try {
    const fontBase64 = await loadRobotoFontBase64();
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
  } catch (e) {
    console.error('Failed to load PDF font:', e);
  }

  const money = (v: number) => formatMoney(v, invoice.currency);
  let y = 20;

  doc.setFontSize(18);
  doc.text(`${labels.invoice} № ${invoice.number}`, 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(`${labels.issueDate}: ${format(new Date(invoice.issue_date), 'dd.MM.yyyy')}`, 14, y);
  if (invoice.due_date) {
    doc.text(`${labels.dueDate}: ${format(new Date(invoice.due_date), 'dd.MM.yyyy')}`, 90, y);
  }
  y += 10;

  const supplierLines = [
    company.name,
    company.tin ? `${company.tin}` : '',
    company.address,
    company.iban ? `IBAN: ${company.iban}` : '',
    company.bank,
    company.phone,
    company.email,
  ].filter(Boolean) as string[];

  const customerLines = [
    client?.company,
    client?.name,
    client?.email,
    client?.phone,
  ].filter(Boolean) as string[];

  doc.setFontSize(11);
  doc.text(labels.supplier, 14, y);
  doc.text(labels.customer, 110, y);
  doc.setFontSize(9);
  let sy = y + 6;
  supplierLines.forEach((line) => {
    doc.text(doc.splitTextToSize(line, 85), 14, sy);
    sy += 5;
  });
  let cy = y + 6;
  customerLines.forEach((line) => {
    doc.text(doc.splitTextToSize(line, 85), 110, cy);
    cy += 5;
  });
  y = Math.max(sy, cy) + 6;

  if (invoice.title) {
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(invoice.title, 180), 14, y);
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [[labels.itemName, labels.quantity, labels.price, labels.total]],
    body: (invoice.items || []).map((item) => [
      item.description ? `${item.name}\n${item.description}` : item.name,
      String(item.quantity),
      money(item.price),
      money(item.quantity * item.price),
    ]),
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

  doc.setFontSize(10);
  doc.text(`${labels.subtotal}: ${money(invoice.subtotal)}`, 130, y);
  y += 6;
  if (invoice.tax_rate > 0) {
    doc.text(`${labels.tax} (${invoice.tax_rate}%): ${money(invoice.tax_amount)}`, 130, y);
    y += 6;
  }
  doc.setFontSize(12);
  doc.text(`${labels.grandTotal}: ${money(invoice.total_amount)}`, 130, y);
  y += 12;

  if (invoice.notes) {
    doc.setFontSize(9);
    doc.text(`${labels.notes}:`, 14, y);
    y += 5;
    doc.text(doc.splitTextToSize(invoice.notes, 180), 14, y);
    y += 12;
  }

  if (company.footer) {
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(company.footer, 180), 14, 278);
  }

  doc.setFontSize(10);
  doc.text(`${labels.signature}: ______________________  ${company.director ?? ''}`, 14, Math.min(y + 6, 265));

  doc.save(`invoice-${invoice.number}.pdf`);
};
