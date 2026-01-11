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
import { Loader2, Play, Plus } from 'lucide-react';

interface ProcessField {
  id: string;
  name: string;
  field_type: string;
  options: unknown;
  sort_order: number;
}

interface Department {
  id: string;
  name: string;
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
  const [runName, setRunName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<ProcessField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFields();
      fetchDepartments();
      setRunName('');
      setSelectedDepartment('');
    }
  }, [open, process.id]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    if (data) setDepartments(data);
  };

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

  const addDepartment = async () => {
    if (!newDeptName.trim() || !user) return;
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: newDeptName.trim(), created_by: user.id })
      .select()
      .single();
    
    if (!error && data) {
      setDepartments([...departments, data]);
      setSelectedDepartment(data.id);
      setNewDeptName('');
      setIsAddingDept(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !runName.trim() || !selectedDepartment) return;
    setSubmitting(true);

    const { error } = await supabase.from('process_runs').insert({
      process_id: process.id,
      field_values: {
        _run_name: runName.trim(),
        _initiator_department: selectedDepartment,
        ...fieldValues,
      },
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

  const isValid = runName.trim() && selectedDepartment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('runProcess')}: {process.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Required: Run Name */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('runName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder={t('enterRunName')}
              />
            </div>

            {/* Required: Initiator Department */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('initiatorDepartment')} <span className="text-destructive">*</span>
              </Label>
              {isAddingDept ? (
                <div className="flex gap-2">
                  <Input
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder={t('newDepartmentName')}
                    onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
                    autoFocus
                  />
                  <Button size="sm" onClick={addDepartment}>{t('add')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingDept(false)}>{t('cancel')}</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('selectDepartment')} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" onClick={() => setIsAddingDept(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Dynamic process fields */}
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
              <Button onClick={handleSubmit} disabled={submitting || !isValid}>
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