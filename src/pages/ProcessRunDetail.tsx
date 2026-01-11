import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Play, CheckCircle, XCircle, Send, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface ProcessRun {
  id: string;
  process_id: string;
  field_values: Record<string, unknown>;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
}

interface Process {
  id: string;
  title: string;
  description: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
}

const ProcessRunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [run, setRun] = useState<ProcessRun | null>(null);
  const [process, setProcess] = useState<Process | null>(null);
  const [starterProfile, setStarterProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const [runRes, deptsRes] = await Promise.all([
      supabase.from('process_runs').select('*').eq('id', id).maybeSingle(),
      supabase.from('departments').select('*'),
    ]);

    if (runRes.data) {
      const runData = {
        ...runRes.data,
        field_values: runRes.data.field_values as Record<string, unknown>,
      };
      setRun(runData);

      // Fetch process
      const { data: processData } = await supabase
        .from('processes')
        .select('id, title, description')
        .eq('id', runData.process_id)
        .maybeSingle();
      if (processData) setProcess(processData);

      // Fetch starter profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, user_id, name, avatar_url, avatar_color')
        .eq('user_id', runData.started_by)
        .maybeSingle();
      if (profileData) setStarterProfile(profileData);
    }

    if (deptsRes.data) setDepartments(deptsRes.data);
    setLoading(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!run || !user) return;
    
    const updateData: { status: string; completed_at?: string | null } = { status: newStatus };
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabase
      .from('process_runs')
      .update(updateData)
      .eq('id', run.id);

    if (!error) {
      setRun({ ...run, ...updateData });
      toast({ title: t('statusUpdated') });
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle, label: t('status_completed') || 'Завершено' };
      case 'in_progress':
        return { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Play, label: t('status_in_progress') || 'В работе' };
      case 'cancelled':
        return { color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle, label: t('status_cancelled') || 'Отменено' };
      default:
        return { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: Clock, label: t('status_pending') || 'Ожидает' };
    }
  };

  const getDepartmentName = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || deptId;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!run || !process) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('processRunNotFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProcesses')}
        </Button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(run.status);
  const StatusIcon = statusConfig.icon;
  const runName = run.field_values._run_name as string || t('untitled');
  const initiatorDept = run.field_values._initiator_department as string;

  // Filter out system fields for display
  const displayFields = Object.entries(run.field_values).filter(
    ([key]) => !key.startsWith('_')
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{runName}</h1>
          <p className="text-muted-foreground">{process.title}</p>
        </div>
        <Badge className={`${statusConfig.color} border`}>
          <StatusIcon className="h-3.5 w-3.5 mr-1" />
          {statusConfig.label}
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="md:col-span-2 space-y-6">
          {/* Process info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('processInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('description')}</p>
                  <p className="text-sm">{process.description}</p>
                </div>
              )}
              
              {initiatorDept && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('initiatorDepartment')}</p>
                  <Badge variant="secondary">{getDepartmentName(initiatorDept)}</Badge>
                </div>
              )}

              {displayFields.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium text-muted-foreground">{t('fields')}</p>
                  {displayFields.map(([key, value]) => (
                    <div key={key} className="flex justify-between items-start gap-4">
                      <span className="text-sm font-medium">{key}</span>
                      <span className="text-sm text-muted-foreground text-right">
                        {String(value) || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments section - placeholder for future */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('comments')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('noComments') || 'Комментариев пока нет'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('status')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={run.status} onValueChange={updateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('status_pending') || 'Ожидает'}</SelectItem>
                  <SelectItem value="in_progress">{t('status_in_progress') || 'В работе'}</SelectItem>
                  <SelectItem value="completed">{t('status_completed') || 'Завершено'}</SelectItem>
                  <SelectItem value="cancelled">{t('status_cancelled') || 'Отменено'}</SelectItem>
                </SelectContent>
              </Select>

              {run.status === 'pending' && (
                <Button className="w-full" onClick={() => updateStatus('in_progress')}>
                  <Play className="h-4 w-4 mr-2" />
                  {t('takeToWork') || 'Взять в работу'}
                </Button>
              )}

              {run.status === 'in_progress' && (
                <Button className="w-full" variant="outline" onClick={() => updateStatus('completed')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('markComplete') || 'Завершить'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('info')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('startedBy')}</p>
                {starterProfile && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={starterProfile.avatar_url || undefined} />
                      <AvatarFallback 
                        className="text-xs"
                        style={{ backgroundColor: starterProfile.avatar_color || undefined }}
                      >
                        {getInitials(starterProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{starterProfile.name}</span>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('startedAt')}</p>
                <p className="text-sm">
                  {format(new Date(run.started_at), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                </p>
              </div>

              {run.completed_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('completedAt')}</p>
                  <p className="text-sm">
                    {format(new Date(run.completed_at), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessRunDetail;
