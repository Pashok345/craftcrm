import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Play } from 'lucide-react';

interface ProcessField {
  id: string;
  name: string;
  field_type: string;
  options: unknown;
  sort_order: number;
}

interface Process {
  id: string;
  title: string;
  process_fields?: ProcessField[];
}

interface RunProcessDialogProps {
  open: boolean;
  onOpenChange: () => void;
  process: Process;
  onRun: () => void;
}

export const RunProcessDialog = ({
  open,
  onOpenChange,
  process,
  onRun,
}: RunProcessDialogProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<ProcessField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFields();
    }
  }, [open, process.id]);

  const fetchFields = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('process_fields')
      .select('*')
      .eq('process_id', process.id)
      .order('sort_order');
    
    if (data) {
      setFields(data);
      // Initialize field values
      const initialValues: Record<string, string> = {};
      data.forEach((field) => {
        initialValues[field.name] = '';
      });
      setFieldValues(initialValues);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    const { error } = await supabase.from('process_runs').insert({
      process_id: process.id,
      field_values: fieldValues,
      started_by: user.id,
      status: 'pending',
    });

    setSubmitting(false);

    if (!error) {
      onRun();
    }
  };

  const updateFieldValue = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const renderField = (field: ProcessField) => {
    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            value={fieldValues[field.name] || ''}
            onChange={(e) => updateFieldValue(field.name, e.target.value)}
            rows={3}
          />
        );
      case 'select':
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <Select
            value={fieldValues[field.name] || ''}
            onValueChange={(value) => updateFieldValue(field.name, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectOption')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            value={fieldValues[field.name] || ''}
            onChange={(e) => updateFieldValue(field.name, e.target.value)}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('runProcess')}: {process.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : fields.length === 0 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">{t('noFieldsToFill')}</p>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {t('startProcess')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label>{field.name}</Label>
                {renderField(field)}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onOpenChange}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {t('startProcess')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
