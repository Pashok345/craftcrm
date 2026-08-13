import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DataPagination } from '@/components/ui/data-pagination';
import { Plus, Search, Mail, Phone, Building2, User } from 'lucide-react';
import { ClientDialog } from './ClientDialog';
import { ClientDetailDialog } from './ClientDetailDialog';
import { ClientImportExport } from './ClientImportExport';
import type { Client } from '@/types/sales';

export const ClientsList = () => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', debouncedSearch, page, pageSize],
    queryFn: async () => {
      let query = supabase.from('clients').select('*', { count: 'exact' }).order('name');
      const q = debouncedSearch.trim().replace(/[%,()]/g, '');
      if (q) {
        query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);
      }
      const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return { rows: (data || []) as Client[], count: count || 0 };
    },
  });

  const filteredClients = data?.rows ?? [];
  const totalClients = data?.count ?? 0;


  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchClients')}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <ClientImportExport clients={filteredClients} />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addClient')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">{t('noClients')}</h3>
            <p className="text-muted-foreground text-sm">{t('addFirstClient')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedClient(client);
                setDetailDialogOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    className="h-12 w-12"
                    style={{ backgroundColor: client.avatar_color || '#3B82F6' }}
                  >
                    <AvatarFallback
                      className="text-white font-medium"
                      style={{ backgroundColor: client.avatar_color || '#3B82F6' }}
                    >
                      {getInitials(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{client.name}</h3>
                    {client.company && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{client.company}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {selectedClient && (
        <ClientDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          client={selectedClient}
        />
      )}
    </div>
  );
};
