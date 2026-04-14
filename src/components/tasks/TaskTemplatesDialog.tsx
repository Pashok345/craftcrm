import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Play, Repeat, Pencil } from 'lucide-react';

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  status: string;
  project_id: string | null;
  color: string | null;
  recurrence_type: string;
  recurrence_interval: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskGenerated?: () => void;
}

export const TaskTemplatesDialog = ({ open, onOpenChange, onTaskGenerated }: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [interval, setInterval] = useState(1);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as TaskTemplate[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRecurrenceType('daily');
    setInterval(1);
    setIsActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;
    
    if (editingId) {
      await supabase.from('task_templates').update({
        title: title.trim(),
        description: description.trim() || null,
        recurrence_type: recurrenceType,
        recurrence_interval: interval,
        is_active: isActive,
      }).eq('id', editingId);
      toast({ title: t('templateUpdated') });
    } else {
      await supabase.from('task_templates').insert({
        title: title.trim(),
        description: description.trim() || null,
        recurrence_type: recurrenceType,
        recurrence_interval: interval,
        is_active: isActive,
        created_by: user.id,
      });
      toast({ title: t('templateCreated') });
    }
    resetForm();
    fetchTemplates();
  };

  const handleEdit = (tpl: TaskTemplate) => {
    setTitle(tpl.title);
    setDescription(tpl.description || '');
    setRecurrenceType(tpl.recurrence_type);
    setInterval(tpl.recurrence_interval);
    setIsActive(tpl.is_active);
    setEditingId(tpl.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('task_templates').delete().eq('id', id);
    toast({ title: t('templateDeleted') });
    fetchTemplates();
  };

  const handleGenerate = async (tpl: TaskTemplate) => {
    if (!user) return;
    await supabase.from('tasks').insert({
      title: tpl.title,
      description: tpl.description,
      status: 'todo',
      project_id: tpl.project_id,
      color: tpl.color,
      created_by: user.id,
    });
    toast({ title: t('taskGenerated') });
    onTaskGenerated?.();
  };

  const recurrenceLabel = (type: string, int: number) => {
    const labels: Record<string, string> = { daily: t('daily'), weekly: t('weekly'), monthly: t('monthly') };
    return int > 1 ? `${labels[type]} (×${int})` : labels[type];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {t('recurringTasks')}
          </DialogTitle>
        </DialogHeader>

        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2 w-fit">
            <Plus className="h-4 w-4" />
            {t('createTemplate')}
          </Button>
        )}

        {showForm && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('templateTitle')}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description')}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('recurrenceType')}</Label>
                  <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('daily')}</SelectItem>
                      <SelectItem value="weekly">{t('weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('interval')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{isActive ? t('templateActive') : t('inactive')}</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={!title.trim()}>
                  {editingId ? t('save') : t('createTemplate')}
                </Button>
                <Button variant="outline" onClick={resetForm}>{t('cancel')}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 mt-2">
          {templates.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('noTemplates')}</p>
              <p className="text-sm text-muted-foreground">{t('createFirstTemplate')}</p>
            </div>
          )}
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{tpl.title}</h4>
                    <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                      {tpl.is_active ? t('templateActive') : t('inactive')}
                    </Badge>
                    <Badge variant="outline">
                      {recurrenceLabel(tpl.recurrence_type, tpl.recurrence_interval)}
                    </Badge>
                  </div>
                  {tpl.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{tpl.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button size="icon" variant="ghost" onClick={() => handleGenerate(tpl)} title={t('generateTask')}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(tpl)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
