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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Download, Building2, Calendar, Mail, MessageSquare, Paperclip, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProposalDialog } from './ProposalDialog';
import { ProposalCommentsSection } from './ProposalCommentsSection';
import { ProposalAttachmentsSection } from './ProposalAttachmentsSection';
import { loadRobotoFontBase64 } from '@/utils/fontBase64';
import type { Proposal, Client, Deal } from '@/types/sales';
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/types/sales';

interface ProposalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal & { client?: Client | null; deal?: Deal | null };
}

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
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const generatePDF = async () => {
    const doc = new jsPDF();
    
    // Load font for Cyrillic support
    try {
      const fontBase64 = await loadRobotoFontBase64();
      doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');
    } catch (error) {
      console.error('Failed to load font:', error);
    }
    
    // Title
    doc.setFontSize(20);
    doc.text(t('commercialProposal'), 14, 20);
    
    // Proposal title
    doc.setFontSize(14);
    doc.text(proposal.title, 14, 32);
    
    // Client info
    let yPos = 45;
    if (proposal.client) {
      doc.setFontSize(10);
      doc.text(`${t('client')}: ${proposal.client.name}`, 14, yPos);
      yPos += 6;
      if (proposal.client.company) {
        doc.text(`${t('company')}: ${proposal.client.company}`, 14, yPos);
        yPos += 6;
      }
    }
    
    // Date and validity
    doc.text(`${t('date')}: ${format(new Date(proposal.created_at), 'd MMMM yyyy', { locale: ru })}`, 14, yPos);
    yPos += 6;
    if (proposal.valid_until) {
      doc.text(`${t('validUntil')}: ${format(new Date(proposal.valid_until), 'd MMMM yyyy', { locale: ru })}`, 14, yPos);
      yPos += 6;
    }
    
    yPos += 10;
    
    // Items table
    if (proposal.content && proposal.content.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [[
          t('itemName'),
          t('quantity'),
          t('price'),
          t('total'),
        ]],
        body: proposal.content.map((item) => [
          item.name,
          item.quantity.toString(),
          formatCurrency(item.price),
          formatCurrency(item.quantity * item.price),
        ]),
        foot: [[
          t('total'),
          '',
          '',
          formatCurrency(proposal.total_amount || 0),
        ]],
        styles: { fontSize: 10, font: 'Roboto' },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
      });
    }
    
    doc.save(`proposal-${proposal.id.slice(0, 8)}.pdf`);
    toast({ title: t('pdfGenerated') });
  };

  const handleSendEmail = async () => {
    if (!proposal.client?.email) {
      toast({ 
        title: t('error'), 
        description: t('clientEmailRequired'),
        variant: 'destructive' 
      });
      return;
    }

    setSendingEmail(true);
    try {
      // Update proposal status to 'sent'
      await supabase
        .from('proposals')
        .update({ status: 'sent' })
        .eq('id', proposal.id);

      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ 
        title: t('proposalSentSuccess'),
        description: `${t('sentTo')}: ${proposal.client.email}`
      });
    } catch (error) {
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    {proposal.client.email && (
                      <p className="text-xs text-muted-foreground">{proposal.client.email}</p>
                    )}
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

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button variant="outline" onClick={generatePDF}>
                <Download className="h-4 w-4 mr-2" />
                {t('downloadPDF')}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSendEmail}
                disabled={sendingEmail || !proposal.client?.email}
              >
                <Mail className="h-4 w-4 mr-2" />
                {t('sendProposalEmail')}
              </Button>
              <div className="flex-1" />
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

            <Separator />

            <Tabs defaultValue="comments" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="comments" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('comments')}
                </TabsTrigger>
                <TabsTrigger value="attachments" className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  {t('attachments')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="mt-4">
                <ProposalCommentsSection proposalId={proposal.id} />
              </TabsContent>
              <TabsContent value="attachments" className="mt-4">
                <ProposalAttachmentsSection proposalId={proposal.id} />
              </TabsContent>
            </Tabs>
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
