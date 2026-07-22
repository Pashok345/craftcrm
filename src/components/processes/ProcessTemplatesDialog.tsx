import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Palmtree,
  CreditCard,
  FileSignature,
  Plane,
  UserPlus,
  FileText,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface TemplateField {
  name: string;
  field_type: string;
  options?: string[];
}
interface TemplateData {
  fields?: TemplateField[];
}
interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_system: boolean;
  template_data: TemplateData;
  created_by: string | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palmtree,
  CreditCard,
  FileSignature,
  Plane,
  UserPlus,
  FileText,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export const ProcessTemplatesDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('process_templates')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name');
    if (data) {
      setTemplates(
        data.map((d: any) => ({
          ...d,
          template_data: (d.template_data || {}) as TemplateData,
        }))
      );
    }
    setLoading(false);
  };

  const createFromTemplate = async (tpl: ProcessTemplate) => {
    if (!user) return;
    setCreatingId(tpl.id);
    try {
      const fields = tpl.template_data?.fields || [];
      // Navigate to editor with prefilled data — user saves manually
      navigate('/processes/new', {
        state: {
          template: {
            title: tpl.name,
            description: tpl.description || '',
            fields: fields.map((f, i) => ({
              name: f.name,
              field_type: f.field_type,
              options: f.options || null,
              sort_order: i,
              required: false,
            })),
          },
        },
      });
      onOpenChange(false);
    } finally {
      setCreatingId(null);
    }
  };


  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('process_templates').delete().eq('id', id);
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
      return;
    }
    fetchTemplates();
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto pr-12">
        <DialogHeader>
          <DialogTitle>{t('processTemplates') || 'Шаблони процесів'}</DialogTitle>
          <DialogDescription>
            {t('processTemplatesDescription') ||
              'Оберіть готовий шаблон, щоб швидко створити процес із набором полів.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchTemplates') || 'Пошук шаблонів...'}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t('noTemplates') || 'Шаблонів не знайдено'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((tpl) => {
              const Icon = ICON_MAP[tpl.icon || 'FileText'] || FileText;
              const fieldsCount = tpl.template_data?.fields?.length || 0;
              const canDelete = isAdmin || (!tpl.is_system && tpl.created_by === user?.id);
              return (
                <Card
                  key={tpl.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer group relative"
                  onClick={() => createFromTemplate(tpl)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{tpl.name}</h4>
                        {tpl.is_system && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t('systemTemplate') || 'Системний'}
                          </Badge>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {tpl.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {fieldsCount} {t('fields')}
                      </p>
                    </div>
                    {creatingId === tpl.id && (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    )}
                  </div>
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTemplate(tpl.id);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
