import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DataPagination } from '@/components/ui/data-pagination';
import { ScrollText, Search, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  record_label: string | null;
  action: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  changed_fields: string[];
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const TABLES = [
  'projects',
  'tasks',
  'deals',
  'clients',
  'invoices',
  'proposals',
  'processes',
  'process_runs',
  'wiki_articles',
  'meetings',
  'user_roles',
];

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-crm-success/10 text-crm-success border-crm-success/30',
  UPDATE: 'bg-primary/10 text-primary border-primary/30',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function AuditLog() {
  const { t } = useLanguage();
  const { can, loading: roleLoading } = usePermissions();
  const isAdmin = can('auditlog.view');

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, tableFilter, actionFilter, pageSize]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      const q = search.trim();
      if (q) {
        query = query.or(
          `record_label.ilike.%${q}%,user_name.ilike.%${q}%,user_email.ilike.%${q}%`
        );
      }

      const { data, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
      if (!alive) return;
      setEntries((data || []) as unknown as AuditEntry[]);
      setTotal(count || 0);
      setLoading(false);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [isAdmin, page, pageSize, search, tableFilter, actionFilter]);

  const tableLabel = useMemo(
    () => (name: string) => {
      const key = `auditTable_${name}`;
      const label = t(key);
      return label === key ? name : label;
    },
    [t]
  );

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const initials = (name?: string | null, email?: string | null) =>
    (name || email || '?')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const renderValue = (v: unknown) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <ScrollText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('auditLog')}</h1>
          <p className="text-muted-foreground">{t('auditLogDescription')}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('auditSearchPlaceholder')}
          />
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('auditAllSections')}</SelectItem>
            {TABLES.map((tbl) => (
              <SelectItem key={tbl} value={tbl}>
                {tableLabel(tbl)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('auditAllActions')}</SelectItem>
            <SelectItem value="INSERT">{t('auditActionInsert')}</SelectItem>
            <SelectItem value="UPDATE">{t('auditActionUpdate')}</SelectItem>
            <SelectItem value="DELETE">{t('auditActionDelete')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {t('auditEmpty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials(e.user_name, e.user_email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={ACTION_COLORS[e.action]}>
                      {t(`auditAction${e.action.charAt(0)}${e.action.slice(1).toLowerCase()}`)}
                    </Badge>
                    <Badge variant="secondary">{tableLabel(e.table_name)}</Badge>
                    <span className="font-medium truncate">{e.record_label || e.record_id?.slice(0, 8) || '—'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {e.user_name || e.user_email || t('auditSystem')} ·{' '}
                    {format(new Date(e.created_at), 'dd.MM.yyyy HH:mm')}
                    {e.changed_fields?.length ? ` · ${e.changed_fields.join(', ')}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelected(e)} aria-label={t('auditDetails')}>
                  <Eye className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

          <DataPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="pr-12">
            <DialogTitle>{t('auditDetails')}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">{t('auditWho')}</p>
                  <p className="font-medium break-words">{selected.user_name || selected.user_email || t('auditSystem')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('auditWhen')}</p>
                  <p className="font-medium">{format(new Date(selected.created_at), 'dd.MM.yyyy HH:mm:ss')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('auditSection')}</p>
                  <p className="font-medium">{tableLabel(selected.table_name)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('auditRecord')}</p>
                  <p className="font-medium break-words">{selected.record_label || selected.record_id || '—'}</p>
                </div>
              </div>

              {selected.action === 'UPDATE' ? (
                <div className="space-y-2">
                  <p className="font-medium">{t('auditChanges')}</p>
                  <div className="rounded-lg border divide-y">
                    {selected.changed_fields.map((f) => (
                      <div key={f} className="grid grid-cols-3 gap-2 p-2">
                        <span className="text-muted-foreground break-words">{f}</span>
                        <span className="line-through break-words opacity-70">
                          {renderValue(selected.old_data?.[f])}
                        </span>
                        <span className="break-words">{renderValue(selected.new_data?.[f])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">{t('auditData')}</p>
                  <pre className="rounded-lg border p-3 text-xs whitespace-pre-wrap break-words bg-muted/40">
                    {JSON.stringify(selected.new_data || selected.old_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
