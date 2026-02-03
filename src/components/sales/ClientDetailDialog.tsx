import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Phone, Building2, Briefcase, Pencil, Trash2, Plus, FileText, Users, Phone as PhoneIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ClientDialog } from './ClientDialog';
import type { Client, ClientInteraction, Deal } from '@/types/sales';
import { INTERACTION_TYPES } from '@/types/sales';

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}

export const ClientDetailDialog = ({
  open,
  onOpenChange,
  client,
}: ClientDetailDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [interactionType, setInteractionType] = useState<string>('call');
  const [interactionText, setInteractionText] = useState('');

  const { data: interactions = [] } = useQuery({
    queryKey: ['client-interactions', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_interactions')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientInteraction[];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['client-deals', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  const addInteractionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('client_interactions').insert({
        client_id: client.id,
        type: interactionType,
        description: interactionText,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-interactions', client.id] });
      setInteractionText('');
      toast({ title: t('interactionAdded') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: t('clientDeleted') });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <PhoneIcon className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-10">
            <div className="flex items-center gap-4">
              <Avatar
                className="h-16 w-16"
                style={{ backgroundColor: client.avatar_color || '#3B82F6' }}
              >
                <AvatarFallback
                  className="text-white text-xl font-medium"
                  style={{ backgroundColor: client.avatar_color || '#3B82F6' }}
                >
                  {getInitials(client.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">{client.name}</DialogTitle>
                {client.company && (
                  <p className="text-muted-foreground flex items-center gap-1 mt-1">
                    <Building2 className="h-4 w-4" />
                    {client.company}
                    {client.position && ` · ${client.position}`}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('email')}</p>
                  <p className="text-sm font-medium">{client.email}</p>
                </div>
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('phone')}</p>
                  <p className="text-sm font-medium">{client.phone}</p>
                </div>
              </a>
            )}
          </div>

          <Tabs defaultValue="interactions" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="interactions" className="flex-1">
                {t('interactionHistory')}
              </TabsTrigger>
              <TabsTrigger value="deals" className="flex-1">
                {t('clientDeals')} ({deals.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="interactions" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Select value={interactionType} onValueChange={setInteractionType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERACTION_TYPES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={interactionText}
                  onChange={(e) => setInteractionText(e.target.value)}
                  placeholder={t('interactionDescription')}
                  className="flex-1 min-h-[40px] resize-none"
                  rows={1}
                />
                <Button
                  size="icon"
                  onClick={() => addInteractionMutation.mutate()}
                  disabled={!interactionText.trim() || addInteractionMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {interactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {t('noInteractions')}
                  </p>
                ) : (
                  interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="flex gap-3 p-3 rounded-lg border"
                    >
                      <div className="p-2 rounded-full bg-muted">
                        {getInteractionIcon(interaction.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {INTERACTION_TYPES[interaction.type as keyof typeof INTERACTION_TYPES]?.label || interaction.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(interaction.created_at), 'd MMM yyyy, HH:mm', {
                              locale: ru,
                            })}
                          </span>
                        </div>
                        <p className="text-sm">{interaction.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="deals" className="mt-4">
              {deals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('noDealsForClient')}
                </p>
              ) : (
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{deal.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {deal.amount
                            ? new Intl.NumberFormat('ru-RU', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0,
                              }).format(deal.amount)
                            : t('noAmount')}
                        </p>
                      </div>
                      {deal.probability && (
                        <Badge variant="secondary">{deal.probability}%</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {client.notes && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-1">{t('notes')}</p>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
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
        </DialogContent>
      </Dialog>

      <ClientDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        client={client}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteClient')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteClientConfirm')}</AlertDialogDescription>
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
