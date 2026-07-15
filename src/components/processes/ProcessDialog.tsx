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
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProcessType {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface ProcessField {
  id?: string;
  name: string;
  field_type: string;
  options: string[] | null;
  sort_order: number;
}

interface Process {
  id: string;
  title: string;
  description: string | null;
  type_id: string | null;
  department_id: string | null;
  category_id?: string | null;
  process_fields?: ProcessField[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface ProcessDialogProps {
  open: boolean;
  onOpenChange: () => void;
  process: Process | null;
  processTypes: ProcessType[];
  departments: Department[];
  categories?: Category[];
  onSaved: () => void;
  onTypesChange: () => void;
  onDepartmentsChange: () => void;
  onDeleted?: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'fieldTypeText' },
  { value: 'textarea', label: 'fieldTypeTextarea' },
  { value: 'select', label: 'fieldTypeSelect' },
];

export const ProcessDialog = ({
  open,
  onOpenChange,
  process,
  processTypes,
  departments,
  categories = [],
  onSaved,
  onTypesChange,
  onDepartmentsChange,
  onDeleted,
}: ProcessDialogProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeId, setTypeId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [fields, setFields] = useState<ProcessField[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!process) return;
    setDeleting(true);
    try {
      // Delete related data in order: attachments, comments, runs, fields, then process
      const { data: runs } = await supabase
        .from('process_runs')
        .select('id')
        .eq('process_id', process.id);

      if (runs && runs.length > 0) {
        const runIds = runs.map(r => r.id);
        await supabase.from('process_run_attachments').delete().in('process_run_id', runIds);
        await supabase.from('process_run_comments').delete().in('process_run_id', runIds);
        await supabase.from('process_runs').delete().eq('process_id', process.id);
      }

      await supabase.from('process_fields').delete().eq('process_id', process.id);
      const { error } = await supabase.from('processes').delete().eq('id', process.id);
      if (error) throw error;

      toast({ title: t('processDeleted') || 'Процесс удалён' });
      onDeleted?.();
    } catch (error) {
      console.error('Error deleting process:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (process) {
      setTitle(process.title);
      setDescription(process.description || '');
      setTypeId(process.type_id || '');
      setDepartmentId(process.department_id || '');
      setCategoryId(process.category_id || '');
      setFields(process.process_fields || []);
    } else {
      setTitle('');
      setDescription('');
      setTypeId('');
      setDepartmentId('');
      setCategoryId('');
      setFields([]);
    }
  }, [process, open]);


  const addField = () => {
    setFields([
      ...fields,
      {
        name: '',
        field_type: 'text',
        options: null,
        sort_order: fields.length,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<ProcessField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const addNewType = async () => {
    if (!newTypeName.trim() || !user) return;
    const { error } = await supabase
      .from('process_types')
      .insert({ name: newTypeName.trim(), created_by: user.id });
    if (!error) {
      setNewTypeName('');
      onTypesChange();
      toast({ title: t('typeAdded') });
    }
  };

  const addNewDepartment = async () => {
    if (!newDeptName.trim() || !user) return;
    const { error } = await supabase
      .from('departments')
      .insert({ name: newDeptName.trim(), created_by: user.id });
    if (!error) {
      setNewDeptName('');
      onDepartmentsChange();
      toast({ title: t('departmentAdded') });
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);

    try {
      let processId = process?.id;

      if (process) {
        // Update existing process
        const { error } = await supabase
          .from('processes')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            type_id: typeId || null,
            department_id: departmentId || null,
          })
          .eq('id', process.id);
        if (error) throw error;
      } else {
        // Create new process
        const { data, error } = await supabase
          .from('processes')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            type_id: typeId || null,
            department_id: departmentId || null,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        processId = data.id;
      }

      // Handle fields
      if (processId) {
        // Delete removed fields
        if (process?.process_fields) {
          const currentFieldIds = fields.filter(f => f.id).map(f => f.id);
          const fieldsToDelete = process.process_fields
            .filter(f => f.id && !currentFieldIds.includes(f.id))
            .map(f => f.id);
          
          if (fieldsToDelete.length > 0) {
            await supabase
              .from('process_fields')
              .delete()
              .in('id', fieldsToDelete);
          }
        }

        // Upsert fields
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          if (field.id) {
            // Update existing
            await supabase
              .from('process_fields')
              .update({
                name: field.name,
                field_type: field.field_type,
                options: field.options,
                sort_order: i,
              })
              .eq('id', field.id);
          } else {
            // Insert new
            await supabase.from('process_fields').insert({
              process_id: processId,
              name: field.name,
              field_type: field.field_type,
              options: field.options,
              sort_order: i,
            });
          }
        }
      }

      onSaved();
    } catch (error) {
      console.error('Error saving process:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {process ? t('editProcess') : t('createProcess')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>{t('processName')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('enterProcessName')}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>{t('processType')}</Label>
            <div className="flex gap-2">
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {processTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder={t('newTypeName')}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={addNewType}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('processDescriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>{t('responsibleDepartment')}</Label>
            <div className="flex gap-2">
              <Select value={departmentId} onValueChange={setDepartmentId}>
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
            </div>
            <div className="flex gap-2">
              <Input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder={t('newDepartmentName')}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={addNewDepartment}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Custom Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('customFields')}</Label>
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" />
                {t('addField')}
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/50">
                <div className="flex-1 space-y-2">
                  <Input
                    value={field.name}
                    onChange={(e) => updateField(index, { name: e.target.value })}
                    placeholder={t('fieldName')}
                  />
                  <Select
                    value={field.field_type}
                    onValueChange={(value) => updateField(index, { field_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {t(type.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.field_type === 'select' && (
                    <Input
                      value={field.options?.join(', ') || ''}
                      onChange={(e) =>
                        updateField(index, {
                          options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder={t('selectOptionsPlaceholder')}
                    />
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {process && isAdmin ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('deleteProcess') || 'Удалить процесс'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete') || 'Подтвердите удаление'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('deleteProcessConfirm') || 'Процесс и все его запуски будут удалены безвозвратно. Продолжить?'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t('delete') || 'Удалить'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onOpenChange}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? t('loading') : t('save')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
