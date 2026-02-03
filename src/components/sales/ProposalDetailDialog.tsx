import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Download, Building2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProposalDialog } from './ProposalDialog';
import type { Proposal, Client, Deal } from '@/types/sales';
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/types/sales';

interface ProposalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal & { client?: Client | null; deal?: Deal | null };
}

// Transliteration for PDF
const transliterate = (text: string): string => {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'і': 'i', 'ї': 'yi',
    'є': 'ye', 'ґ': 'g',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '',
    'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya', 'І': 'I', 'Ї': 'Yi',
    'Є': 'Ye', 'Ґ': 'G',
  };
  return text.split('').map((char) => map[char] || char).join('');
};

export const ProposalDetailDialog = ({
  open,
  onOpenChange,
  proposal,
}: ProposalDetailDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('proposals').delete().eq('id', proposal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: t('proposalDeleted') });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(transliterate(t('commercialProposal')), 14, 20);
    
    // Proposal title
    doc.setFontSize(14);
    doc.text(transliterate(proposal.title), 14, 32);
    
    // Client info
    let yPos = 45;
    if (proposal.client) {
      doc.setFontSize(10);
      doc.text(`${transliterate(t('client'))}: ${transliterate(proposal.client.name)}`, 14, yPos);
      yPos += 6;
      if (proposal.client.company) {
        doc.text(`${transliterate(t('company'))}: ${transliterate(proposal.client.company)}`, 14, yPos);
        yPos += 6;
      }
    }
    
    // Date and validity
    doc.text(`${transliterate(t('date'))}: ${format(new Date(proposal.created_at), 'd MMMM yyyy', { locale: ru })}`, 14, yPos);
    yPos += 6;
    if (proposal.valid_until) {
      doc.text(`${transliterate(t('validUntil'))}: ${format(new Date(proposal.valid_until), 'd MMMM yyyy', { locale: ru })}`, 14, yPos);
      yPos += 6;
    }
    
    yPos += 10;
    
    // Items table
    if (proposal.content && proposal.content.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [[
          transliterate(t('itemName')),
          transliterate(t('quantity')),
          transliterate(t('price')),
          transliterate(t('total')),
        ]],
        body: proposal.content.map((item) => [
          transliterate(item.name),
          item.quantity.toString(),
          formatCurrency(item.price),
          formatCurrency(item.quantity * item.price),
        ]),
        foot: [[
          transliterate(t('total')),
          '',
          '',
          formatCurrency(proposal.total_amount || 0),
        ]],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
      });
    }
    
    doc.save(`proposal-${proposal.id.slice(0, 8)}.pdf`);
    toast({ title: t('pdfGenerated') });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-10">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">{proposal.title}</DialogTitle>
              <Badge
                className={PROPOSAL_STATUS_COLORS[proposal.status as keyof typeof PROPOSAL_STATUS_COLORS]}
              >
                {PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS]}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {proposal.client && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('client')}</p>
                    <p className="font-medium">{proposal.client.name}</p>
                  </div>
                </div>
              )}
              {proposal.valid_until && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('validUntil')}</p>
                    <p className="font-medium">
                      {format(new Date(proposal.valid_until), 'd MMMM yyyy', { locale: ru })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {proposal.content && proposal.content.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('itemName')}</TableHead>
                      <TableHead className="w-24 text-center">{t('quantity')}</TableHead>
                      <TableHead className="w-32 text-right">{t('price')}</TableHead>
                      <TableHead className="w-32 text-right">{t('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposal.content.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.quantity * item.price)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3} className="font-bold text-right">
                        {t('total')}:
                      </TableCell>
                      <TableCell className="font-bold text-right">
                        {formatCurrency(proposal.total_amount || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={generatePDF}>
                <Download className="h-4 w-4 mr-2" />
                {t('downloadPDF')}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('delete')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProposalDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        proposal={proposal}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProposal')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteProposalConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
