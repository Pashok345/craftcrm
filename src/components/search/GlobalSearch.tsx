import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckSquare, FolderKanban, Users, DollarSign, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'task' | 'project' | 'client' | 'deal';
}

export const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      const pattern = `%${q}%`;
      const [tasksRes, projectsRes, clientsRes, dealsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, status').ilike('title', pattern).limit(5),
        supabase.from('projects').select('id, title, status').ilike('title', pattern).limit(5),
        supabase.from('clients').select('id, name, company').ilike('name', pattern).limit(5),
        supabase.from('deals').select('id, title, amount').ilike('title', pattern).limit(5),
      ]);

      const items: SearchResult[] = [
        ...(tasksRes.data || []).map((t) => ({ id: t.id, title: t.title, subtitle: t.status, type: 'task' as const })),
        ...(projectsRes.data || []).map((p) => ({ id: p.id, title: p.title, subtitle: p.status, type: 'project' as const })),
        ...(clientsRes.data || []).map((c) => ({ id: c.id, title: c.name, subtitle: c.company || undefined, type: 'client' as const })),
        ...(dealsRes.data || []).map((d) => ({ id: d.id, title: d.title, subtitle: d.amount ? `$${d.amount}` : undefined, type: 'deal' as const })),
      ];
      setResults(items);
      setOpen(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const handleSelect = (item: SearchResult) => {
    setOpen(false);
    setQuery('');
    switch (item.type) {
      case 'task': navigate(`/tasks/${item.id}`); break;
      case 'project': navigate('/projects'); break;
      case 'client': navigate('/sales'); break;
      case 'deal': navigate('/sales'); break;
    }
  };

  const iconMap = {
    task: CheckSquare,
    project: FolderKanban,
    client: Users,
    deal: DollarSign,
  };

  const labelMap = {
    task: t('tasks'),
    project: t('projects'),
    client: t('clients') || 'Клиенты',
    deal: t('deals') || 'Сделки',
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={t('globalSearchPlaceholder') || 'Поиск по задачам, проектам, клиентам, сделкам...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          className="pl-9 pr-16 h-10 bg-background"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden max-h-[400px] overflow-y-auto">
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = iconMap[type as keyof typeof iconMap];
            return (
              <div key={type}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                  {labelMap[type as keyof typeof labelMap]}
                </div>
                {items.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {open && query.length >= 3 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg p-4 text-center text-sm text-muted-foreground">
          {t('noResults') || 'Ничего не найдено'}
        </div>
      )}
    </div>
  );
};
