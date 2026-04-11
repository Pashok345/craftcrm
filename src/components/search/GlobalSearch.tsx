import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { CheckSquare, FolderKanban, Users, DollarSign, Search } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'task' | 'project' | 'client' | 'deal';
}

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const pattern = `%${q}%`;
      const [tasksRes, projectsRes, clientsRes, dealsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, status').ilike('title', pattern).limit(5),
        supabase.from('projects').select('id, title, status').ilike('title', pattern).limit(5),
        supabase.from('clients').select('id, name, company').ilike('name', pattern).limit(5),
        supabase.from('deals').select('id, title, amount').ilike('title', pattern).limit(5),
      ]);

      const items: SearchResult[] = [
        ...(tasksRes.data || []).map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.status,
          type: 'task' as const,
        })),
        ...(projectsRes.data || []).map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.status,
          type: 'project' as const,
        })),
        ...(clientsRes.data || []).map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: c.company || undefined,
          type: 'client' as const,
        })),
        ...(dealsRes.data || []).map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: d.amount ? `$${d.amount}` : undefined,
          type: 'deal' as const,
        })),
      ];
      setResults(items);
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
      case 'task':
        navigate(`/tasks/${item.id}`);
        break;
      case 'project':
        navigate('/projects');
        break;
      case 'client':
        navigate('/sales');
        break;
      case 'deal':
        navigate('/sales');
        break;
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
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={t('globalSearchPlaceholder') || 'Поиск по задачам, проектам, клиентам, сделкам...'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? (t('loading') || 'Загрузка...') : (t('noResults') || 'Ничего не найдено')}
        </CommandEmpty>
        {Object.entries(grouped).map(([type, items], idx) => {
          const Icon = iconMap[type as keyof typeof iconMap];
          return (
            <div key={type}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={labelMap[type as keyof typeof labelMap]}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
};
