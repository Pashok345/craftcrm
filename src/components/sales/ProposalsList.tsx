import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ProposalDialog } from './ProposalDialog';
import { ProposalDetailDialog } from './ProposalDetailDialog';
import type { Proposal, Client, Deal, ProposalItem } from '@/types/sales';
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/types/sales';

export const ProposalsList = () => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          client:clients(*),
          deal:deals(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((p: any) => ({
        ...p,
        content: Array.isArray(p.content) ? p.content : [],
      })) as (Proposal & { client: Client | null; deal: Deal | null })[];
    },
  });

  const filteredProposals = proposals.filter(
    (proposal) =>
      proposal.title.toLowerCase().includes(search.toLowerCase()) ||
      proposal.client?.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchProposals')}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createProposal')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredProposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">{t('noProposals')}</h3>
            <p className="text-muted-foreground text-sm">{t('createFirstProposal')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProposals.map((proposal) => (
            <Card
              key={proposal.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedProposal(proposal);
                setDetailDialogOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{proposal.title}</h3>
                      <Badge
                        className={PROPOSAL_STATUS_COLORS[proposal.status as keyof typeof PROPOSAL_STATUS_COLORS]}
                      >
                        {PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS]}
                      </Badge>
                    </div>
                    {proposal.client && (
                      <p className="text-sm text-muted-foreground">
                        {proposal.client.name}
                        {proposal.client.company && ` · ${proposal.client.company}`}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {proposal.total_amount && proposal.total_amount > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(proposal.total_amount)}
                        </span>
                      )}
                      {proposal.valid_until && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t('validUntil')}: {format(new Date(proposal.valid_until), 'd MMM yyyy', { locale: ru })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(proposal.created_at), 'd MMM yyyy', { locale: ru })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProposalDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {selectedProposal && (
        <ProposalDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          proposal={selectedProposal}
        />
      )}
    </div>
  );
};
