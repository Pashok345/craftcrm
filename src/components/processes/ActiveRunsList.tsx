import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Play, CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru, uk, enUS } from 'date-fns/locale';

interface Run {
  id: string;
  process_id: string;
  status: string;
  priority: string;
  started_by: string;
  started_at: string;
  sla_deadline: string | null;
  title: string | null;
  current_step_id: string | null;
  field_values: any;
}

interface Process {
  id: string;
  title: string;
  type_id: string | null;
  category_id: string | null;
}

interface Profile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface Type {
  id: string;
  name: string;
}

export function ActiveRunsList() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [processes, setProcesses] = useState<Record<string, Process>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [types, setTypes] = useState<Type[]>([]);
  const [assignees, setAssignees] = useState<Record<string, string[]>>({}); // run_id -> user_ids
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [initiatorFilter, setInitiatorFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [runsRes, procRes, profRes, typesRes] = await Promise.all([
      supabase.from('process_runs').select('*').order('started_at', { ascending: false }),
      supabase.from('processes').select('id, title, type_id, category_id'),
      supabase.from('profiles').select('user_id, name, avatar_url, avatar_color'),
      supabase.from('process_types').select('id, name'),
    ]);
    if (runsRes.data) {
      const rs = runsRes.data as any[];
      setRuns(rs);
      // fetch pending assignees per run
      const runIds = rs.map(r => r.id);
      if (runIds.length) {
        const { data: stepsData } = await supabase
          .from('process_run_steps')
          .select('run_id, assignee_id, status')
          .in('run_id', runIds)
          .in('status', ['pending', 'in_progress']);
        const map: Record<string, string[]> = {};
        stepsData?.forEach((s: any) => {
          if (!s.assignee_id) return;
          if (!map[s.run_id]) map[s.run_id] = [];
          if (!map[s.run_id].includes(s.assignee_id)) map[s.run_id].push(s.assignee_id);
        });
        setAssignees(map);
      }
    }
    if (procRes.data) {
      const m: Record<string, Process> = {};
      procRes.data.forEach((p: any) => { m[p.id] = p; });
      setProcesses(m);
    }
    if (profRes.data) {
      const m: Record<string, Profile> = {};
      profRes.data.forEach((p: any) => { m[p.user_id] = p; });
      setProfiles(m);
    }
    if (typesRes.data) setTypes(typesRes.data);
    setLoading(false);
  };

  const initiators = useMemo(() => {
    const ids = Array.from(new Set(runs.map(r => r.started_by)));
    return ids.map(id => profiles[id]).filter(Boolean);
  }, [runs, profiles]);

  const allAssignees = useMemo(() => {
    const ids = Array.from(new Set(Object.values(assignees).flat()));
    return ids.map(id => profiles[id]).filter(Boolean);
  }, [assignees, profiles]);

  const filtered = useMemo(() => {
    return runs.filter(r => {
      const proc = processes[r.process_id];
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && proc?.type_id !== typeFilter) return false;
      if (initiatorFilter !== 'all' && r.started_by !== initiatorFilter) return false;
      if (assigneeFilter !== 'all' && !(assignees[r.id] || []).includes(assigneeFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const runName = (r.title || (r.field_values?._run_name as string) || '').toLowerCase();
        const procName = (proc?.title || '').toLowerCase();
        if (!runName.includes(q) && !procName.includes(q)) return false;
      }
      return true;
    });
  }, [runs, processes, statusFilter, typeFilter, initiatorFilter, assigneeFilter, assignees, search]);

  const statusMeta = (s: string) => {
    switch (s) {
      case 'completed': return { icon: CheckCircle, cls: 'bg-green-500/10 text-green-600 border-green-500/30', label: t('status_completed') };
      case 'in_progress': return { icon: Play, cls: 'bg-blue-500/10 text-blue-600 border-blue-500/30', label: t('status_in_progress') };
      case 'cancelled': return { icon: XCircle, cls: 'bg-red-500/10 text-red-600 border-red-500/30', label: t('status_cancelled') };
      default: return { icon: Clock, cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', label: t('status_pending') };
    }
  };

  const priorityMeta = (p: string) => {
    if (p === 'high') return 'bg-red-500/10 text-red-600 border-red-500/30';
    if (p === 'low') return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
    return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
  };

  const initials = (n?: string) => (n || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  if (loading) return (
    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('searchRuns') || 'Пошук запусків...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses') || 'Всі статуси'}</SelectItem>
            <SelectItem value="pending">{t('status_pending')}</SelectItem>
            <SelectItem value="in_progress">{t('status_in_progress')}</SelectItem>
            <SelectItem value="completed">{t('status_completed')}</SelectItem>
            <SelectItem value="cancelled">{t('status_cancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder={t('processType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes') || 'Всі типи'}</SelectItem>
            {types.map(tp => (<SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={initiatorFilter} onValueChange={setInitiatorFilter}>
          <SelectTrigger><SelectValue placeholder={t('initiator') || 'Ініціатор'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allInitiators') || 'Всі ініціатори'}</SelectItem>
            {initiators.map(p => (<SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="md:col-start-5"><SelectValue placeholder={t('assignee') || 'Виконавець'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allAssignees') || 'Всі виконавці'}</SelectItem>
            {allAssignees.map(p => (<SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('noRunsFound') || 'Запусків не знайдено'}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const proc = processes[r.process_id];
            const sm = statusMeta(r.status);
            const StatusIcon = sm.icon;
            const initiator = profiles[r.started_by];
            const runAssignees = (assignees[r.id] || []).map(id => profiles[id]).filter(Boolean);
            const slaOverdue = r.sla_deadline && new Date(r.sla_deadline) < new Date() && r.status !== 'completed' && r.status !== 'cancelled';
            return (
              <Card
                key={r.id}
                className="hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/process-runs/${r.id}`)}
              >
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Badge variant="outline" className={sm.cls}>
                    <StatusIcon className="h-3 w-3 mr-1" />{sm.label}
                  </Badge>
                  <Badge variant="outline" className={priorityMeta(r.priority)}>{r.priority}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {r.title || (r.field_values?._run_name as string) || t('untitled')}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {proc?.title || '—'} · {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: dateLocale })}
                    </div>
                  </div>
                  {slaOverdue && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />SLA
                    </Badge>
                  )}
                  {initiator && (
                    <div className="hidden md:flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">{t('by') || 'від'}</span>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={initiator.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: initiator.avatar_color || undefined }} className="text-[10px]">
                          {initials(initiator.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  {runAssignees.length > 0 && (
                    <div className="hidden md:flex -space-x-2">
                      {runAssignees.slice(0, 3).map(p => (
                        <Avatar key={p.user_id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: p.avatar_color || undefined }} className="text-[10px]">
                            {initials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
