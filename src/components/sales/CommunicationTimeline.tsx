import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Phone,
  Mail,
  Users,
  FileText,
  MessageSquare,
  Receipt,
  Wallet,
  Handshake,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

export type TimelineKind =
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'comment'
  | 'proposal'
  | 'invoice'
  | 'payment'
  | 'deal';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  title: string;
  description?: string;
  created_at: string;
  author_id?: string | null;
}

const KIND_META: Record<TimelineKind, { icon: typeof Phone; color: string }> = {
  call: { icon: Phone, color: 'text-crm-success' },
  email: { icon: Mail, color: 'text-primary' },
  meeting: { icon: Users, color: 'text-crm-warning' },
  note: { icon: FileText, color: 'text-muted-foreground' },
  comment: { icon: MessageSquare, color: 'text-primary' },
  proposal: { icon: FileText, color: 'text-primary' },
  invoice: { icon: Receipt, color: 'text-crm-warning' },
  payment: { icon: Wallet, color: 'text-crm-success' },
  deal: { icon: Handshake, color: 'text-primary' },
};

interface Props {
  clientId?: string;
  dealId?: string;
  compact?: boolean;
}

export const CommunicationTimeline = ({ clientId, dealId, compact }: Props) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const [filter, setFilter] = useState<string[]>([]);
  const [type, setType] = useState('call');
  const [text, setText] = useState('');

  const queryKey = ['communication-timeline', clientId ?? null, dealId ?? null];

  const { data: events = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<TimelineEvent[]> => {
      const out: TimelineEvent[] = [];

      // Resolve related deals + effective client
      let dealIds: string[] = [];
      let effectiveClientId = clientId;

      if (dealId) {
        dealIds = [dealId];
        const { data: d } = await supabase
          .from('deals')
          .select('id, title, client_id, created_at, amount')
          .eq('id', dealId)
          .maybeSingle();
        if (d) {
          effectiveClientId = effectiveClientId || d.client_id || undefined;
          out.push({
            id: `deal-${d.id}`,
            kind: 'deal',
            title: `${t('dealCreatedEvent')}: ${d.title}`,
            created_at: d.created_at,
          });
        }
      } else if (clientId) {
        const { data: ds } = await supabase
          .from('deals')
          .select('id, title, created_at')
          .eq('client_id', clientId);
        dealIds = (ds || []).map((d) => d.id);
        (ds || []).forEach((d) =>
          out.push({
            id: `deal-${d.id}`,
            kind: 'deal',
            title: `${t('dealCreatedEvent')}: ${d.title}`,
            created_at: d.created_at,
          })
        );
      }

      // Client interactions (calls / emails / meetings / notes)
      if (effectiveClientId) {
        const { data: interactions } = await supabase
          .from('client_interactions')
          .select('id, type, description, created_at, created_by')
          .eq('client_id', effectiveClientId)
          .order('created_at', { ascending: false })
          .limit(200);
        (interactions || []).forEach((i) =>
          out.push({
            id: `int-${i.id}`,
            kind: (['call', 'email', 'meeting', 'note'].includes(i.type)
              ? i.type
              : 'note') as TimelineKind,
            title: t(`interactionType_${i.type}` as never) || i.type,
            description: i.description,
            created_at: i.created_at,
            author_id: i.created_by,
          })
        );
      }

      // Deal comments
      if (dealIds.length) {
        const { data: comments } = await supabase
          .from('deal_comments')
          .select('id, content, created_at, user_id, deal_id')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false })
          .limit(200);
        (comments || []).forEach((c) =>
          out.push({
            id: `dc-${c.id}`,
            kind: 'comment',
            title: t('commentEvent'),
            description: c.content,
            created_at: c.created_at,
            author_id: c.user_id,
          })
        );
      }

      // Proposals
      let proposalsQuery = supabase
        .from('proposals')
        .select('id, title, status, total_amount, created_at, created_by, client_id, deal_id')
        .order('created_at', { ascending: false })
        .limit(100);
      proposalsQuery = dealId
        ? proposalsQuery.eq('deal_id', dealId)
        : proposalsQuery.eq('client_id', effectiveClientId ?? '');
      if (dealId || effectiveClientId) {
        const { data: proposals } = await proposalsQuery;
        (proposals || []).forEach((p) =>
          out.push({
            id: `prop-${p.id}`,
            kind: 'proposal',
            title: `${t('proposalEvent')}: ${p.title}`,
            description: p.total_amount ? String(p.total_amount) : undefined,
            created_at: p.created_at,
            author_id: p.created_by,
          })
        );
      }

      // Invoices + payments
      let invoiceIds: string[] = [];
      if (dealId || effectiveClientId) {
        let invQuery = supabase
          .from('invoices')
          .select('id, number, title, total_amount, currency, status, created_at, created_by')
          .order('created_at', { ascending: false })
          .limit(100);
        invQuery = dealId
          ? invQuery.eq('deal_id', dealId)
          : invQuery.eq('client_id', effectiveClientId ?? '');
        const { data: invoices } = await invQuery;
        invoiceIds = (invoices || []).map((i) => i.id);
        (invoices || []).forEach((i) =>
          out.push({
            id: `inv-${i.id}`,
            kind: 'invoice',
            title: `${t('invoiceEvent')} ${i.number}`,
            description: `${i.total_amount} ${i.currency}`,
            created_at: i.created_at,
            author_id: i.created_by,
          })
        );
      }

      if (invoiceIds.length) {
        const { data: payments } = await supabase
          .from('invoice_payments')
          .select('id, amount, paid_at, method, note, created_at, created_by')
          .in('invoice_id', invoiceIds)
          .order('created_at', { ascending: false })
          .limit(200);
        (payments || []).forEach((p) =>
          out.push({
            id: `pay-${p.id}`,
            kind: 'payment',
            title: `${t('paymentEvent')}: ${p.amount}`,
            description: [p.method, p.note].filter(Boolean).join(' · ') || undefined,
            created_at: p.created_at,
            author_id: p.created_by,
          })
        );
      }

      return out.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!(clientId || dealId),
    staleTime: 30_000,
  });

  const authorIds = [...new Set(events.map((e) => e.author_id).filter(Boolean))] as string[];
  const { data: profiles = [] } = useQuery({
    queryKey: ['timeline-profiles', authorIds.sort().join(',')],
    queryFn: async () => {
      if (!authorIds.length) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', authorIds);
      return data || [];
    },
    enabled: authorIds.length > 0,
  });
  const nameOf = (id?: string | null) =>
    profiles.find((p: any) => p.user_id === id)?.name;

  const addInteraction = useMutation({
    mutationFn: async () => {
      let targetClient = clientId;
      if (!targetClient && dealId) {
        const { data } = await supabase
          .from('deals')
          .select('client_id')
          .eq('id', dealId)
          .maybeSingle();
        targetClient = data?.client_id || undefined;
      }
      if (!targetClient) throw new Error('no-client');
      const { error } = await supabase.from('client_interactions').insert({
        client_id: targetClient,
        type,
        description: text.trim(),
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['client-interactions'] });
      toast({ title: t('interactionAdded') });
    },
    onError: () => toast({ title: t('noClientForTimeline'), variant: 'destructive' }),
  });

  const filtered = filter.length
    ? events.filter((e) => filter.includes(e.kind))
    : events;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="call">{t('interactionType_call')}</SelectItem>
            <SelectItem value="email">{t('interactionType_email')}</SelectItem>
            <SelectItem value="meeting">{t('interactionType_meeting')}</SelectItem>
            <SelectItem value="note">{t('interactionType_note')}</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('interactionDescription')}
          className="flex-1 min-w-[200px] min-h-[40px] resize-none"
          rows={1}
        />
        <Button
          size="icon"
          onClick={() => addInteraction.mutate()}
          disabled={!text.trim() || addInteraction.isPending}
          aria-label={t('interactionAdded')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ToggleGroup
        type="multiple"
        value={filter}
        onValueChange={setFilter}
        className="flex flex-wrap justify-start gap-1"
      >
        {(['call', 'email', 'meeting', 'note', 'comment', 'proposal', 'invoice', 'payment', 'deal'] as TimelineKind[]).map(
          (k) => {
            const Icon = KIND_META[k].icon;
            return (
              <ToggleGroupItem key={k} value={k} size="sm" className="h-7 px-2 text-xs gap-1">
                <Icon className="h-3 w-3" />
                {t(`timelineKind_${k}` as never) || k}
              </ToggleGroupItem>
            );
          }
        )}
      </ToggleGroup>

      <div className={`relative space-y-0 ${compact ? 'max-h-72' : 'max-h-[520px]'} overflow-y-auto pr-1`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('noInteractions')}</p>
        ) : (
          filtered.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            return (
              <div key={e.id} className="flex gap-3 pb-4 relative">
                <div className="flex flex-col items-center">
                  <div className={`p-2 rounded-full bg-muted ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 w-px bg-border mt-1" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {t(`timelineKind_${e.kind}` as never) || e.kind}
                    </Badge>
                    <span className="text-sm font-medium truncate">{e.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), 'd MMM yyyy, HH:mm', { locale: dateLocale })}
                    </span>
                    {nameOf(e.author_id) && (
                      <span className="text-xs text-muted-foreground">· {nameOf(e.author_id)}</span>
                    )}
                  </div>
                  {e.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 break-words">
                      {e.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
