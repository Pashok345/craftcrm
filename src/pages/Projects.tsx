import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Plus, Folder, Search, LayoutGrid, List as ListIcon, Clock, Star,
} from 'lucide-react';
import { Project, PROJECT_STATUS_COLORS, Profile } from '@/types/database';
import { ProjectCoverImage } from '@/components/projects/ProjectCoverImage';
import { ShareButton } from '@/components/share/ShareButton';

import { format, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

type SortOption = 'date_desc' | 'date_asc' | 'status' | 'name';
type StatusFilter = 'all' | 'active' | 'completed';
type ViewMode = 'table' | 'cards';

const VIEW_STORAGE_KEY = 'projects.viewMode';
const RECENT_STORAGE_KEY = 'projects.recentIds';
const RECENT_MAX = 4;

const Projects = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return v === 'table' ? 'table' : 'cards';
  });
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_STORAGE_KEY, viewMode); } catch {}
  }, [viewMode]);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const statusLabels: Record<string, string> = {
    planning: t('projectPlanning'),
    active: t('projectActive'),
    on_hold: t('projectOnHold'),
    completed: t('projectCompleted'),
    cancelled: t('projectCancelled'),
  };

  const STATUS_ORDER: Record<string, number> = {
    planning: 0, active: 1, on_hold: 2, completed: 3, cancelled: 4,
  };

  useEffect(() => {
    fetchProjects();
    fetchManagers();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects((data || []) as unknown as Project[]);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      const map: Record<string, Profile> = {};
      (data as Profile[]).forEach((p) => { map[p.user_id] = p; });
      setManagers(map);
    }
  };

  const openProject = (id: string) => {
    try {
      const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, RECENT_MAX);
      setRecentIds(next);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    navigate(`/projects/${id}`);
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;
    if (statusFilter === 'active') {
      filtered = filtered.filter(p => ['planning', 'active', 'on_hold'].includes(p.status));
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(p => ['completed', 'cancelled'].includes(p.status));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'status': return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'name': return a.title.localeCompare(b.title);
        default: return 0;
      }
    });
  }, [projects, searchQuery, sortBy, statusFilter]);

  const recentProjects = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p]));
    return recentIds.map((id) => map.get(id)).filter(Boolean) as Project[];
  }, [projects, recentIds]);

  const formatDate = (d?: string | null) =>
    d ? format(parseISO(d), 'd MMM yyyy', { locale: dateLocale }) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Trello-style tile
  const ProjectTile = ({ project }: { project: Project }) => (
    <button
      onClick={() => openProject(project.id)}
      className="group relative h-24 w-full rounded-lg overflow-hidden border bg-card text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <ProjectCoverImage
        url={project.cover_image_url}
        fallbackColor={project.accent_color}
        className="absolute inset-0 h-full w-full"
        alt={project.title}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </ProjectCoverImage>
      <div className="absolute inset-0 p-2.5 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          {project.icon ? (
            <span className="text-lg leading-none drop-shadow">{project.icon}</span>
          ) : <span />}
          <Badge className={`${PROJECT_STATUS_COLORS[project.status]} text-[10px] px-1.5 py-0`}>
            {statusLabels[project.status]}
          </Badge>
        </div>
        <div className="text-white font-semibold text-sm leading-tight line-clamp-2 drop-shadow">
          {project.title}
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('projectsTitle')}</h1>
          <p className="text-muted-foreground">{t('projectsDescription')}</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('newProject')}
        </Button>
      </div>

      {recentProjects.length > 0 && viewMode === 'cards' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{t('recentlyViewed') || 'Недавно открытые'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {recentProjects.map((p) => <ProjectTile key={p.id} project={p} />)}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allProjects')}</SelectItem>
            <SelectItem value="active">{t('activeProjects')}</SelectItem>
            <SelectItem value="completed">{t('completedProjectsFilter')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">{t('newest')}</SelectItem>
            <SelectItem value="date_asc">{t('oldest')}</SelectItem>
            <SelectItem value="status">{t('sortByStatus')}</SelectItem>
            <SelectItem value="name">{t('sortByName')}</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
          className="border rounded-md p-0.5"
        >
          <ToggleGroupItem value="cards" size="sm" className="h-8 px-2" title="Плитка">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" size="sm" className="h-8 px-2" title="Список">
            <ListIcon className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredAndSortedProjects.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Folder className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">{t('noProjects')}</h3>
            <p className="text-muted-foreground mb-4">{t('createFirstProject')}</p>
            <Button onClick={() => navigate('/projects/new')}>{t('createProject')}</Button>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="h-4 w-4" />
            <span>{t('allYourProjects') || 'Всі проєкти'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredAndSortedProjects.map((project) => (
              <ProjectTile key={project.id} project={project} />
            ))}
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>{t('projectsTitle')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('manager') || 'Менеджер'}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('sortByStatus')}</TableHead>
                  <TableHead className="hidden xl:table-cell">Сроки</TableHead>
                  <TableHead className="w-24 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => openProject(project.id)}
                  >
                    <TableCell>
                      <ProjectCoverImage
                        url={project.cover_image_url}
                        fallbackColor={project.accent_color}
                        className="h-10 w-16 rounded-md border"
                        alt={project.title}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {project.icon && <span className="text-base leading-none">{project.icon}</span>}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{project.title}</div>
                          {project.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-md">
                              {project.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {project.manager_id && managers[project.manager_id]?.name || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                        {statusLabels[project.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {formatDate(project.start_date)}
                      {project.start_date && project.end_date && ' – '}
                      {formatDate(project.end_date)}
                      {!project.start_date && !project.end_date && '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ShareButton
                        type="project"
                        id={project.id}
                        title={project.title}
                        variant="ghost"
                        size="icon"
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Projects;
