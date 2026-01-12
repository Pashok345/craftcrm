import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Folder, Calendar, DollarSign, User } from 'lucide-react';
import { Project, PROJECT_STATUS_COLORS, Profile } from '@/types/database';
import { ProjectDetailDialog } from '@/components/projects/ProjectDetailDialog';
import { format, parseISO } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

const Projects = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  const statusLabels: Record<string, string> = {
    planning: t('projectPlanning'),
    active: t('projectActive'),
    on_hold: t('projectOnHold'),
    completed: t('projectCompleted'),
    cancelled: t('projectCancelled'),
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
      (data as Profile[]).forEach((p) => {
        map[p.user_id] = p;
      });
      setManagers(map);
    }
  };

  const formatBudget = (budget?: number) => {
    if (!budget) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(budget);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('projectsTitle')}</h1>
          <p className="text-muted-foreground">{t('projectsDescription')}</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('newProject')}
        </Button>
      </div>

      {projects.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          {projects.map((project, index) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow animate-slide-up"
              style={{ animationDelay: `${index * 0.03}s` }}
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-foreground truncate flex-1">
                      {project.title}
                    </h3>
                    <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                      {statusLabels[project.status]}
                    </Badge>
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    {project.manager_id && managers[project.manager_id] && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{managers[project.manager_id].name}</span>
                      </div>
                    )}

                    {project.budget && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>{formatBudget(project.budget)}</span>
                      </div>
                    )}

                    {(project.start_date || project.end_date) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {project.start_date && format(parseISO(project.start_date), 'd MMM', { locale: dateLocale })}
                          {project.start_date && project.end_date && ' – '}
                          {project.end_date && format(parseISO(project.end_date), 'd MMM yyyy', { locale: dateLocale })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectDetailDialog
        project={selectedProject}
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
        onUpdate={fetchProjects}
      />
    </div>
  );
};

export default Projects;
