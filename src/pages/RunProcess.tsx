import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Play, Plus, ArrowLeft, Paperclip, X, FileIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  description: string | null;
}

interface UploadedFile {
  file: File;
  name: string;
}

// IBAN mask utility
const formatIBAN = (value: string): string => {
  // Remove all non-alphanumeric characters
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // IBAN max length is 34 characters
  const limited = cleaned.slice(0, 34);
  
  // Format in groups of 4
  const groups = limited.match(/.{1,4}/g) || [];
  return groups.join(' ');
};

const RunProcess = () => {
  const { id: processId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [process, setProcess] = useState<Process | null>(null);
  const [runName, setRunName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<ProcessField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    if (processId) {
      fetchData();
    }
  }, [processId]);

  const fetchData = async () => {
    setLoading(true);
    
    const [processRes, fieldsRes, deptsRes] = await Promise.all([
      supabase.from('processes').select('id, title, description').eq('id', processId).maybeSingle(),
      supabase.from('process_fields').select('*').eq('process_id', processId).order('sort_order'),
      supabase.from('departments').select('*').order('name'),
    ]);

    if (processRes.data) {
      setProcess(processRes.data);
    }

    if (fieldsRes.data) {
      setFields(fieldsRes.data);
      const initialValues: Record<string, string> = {};
      fieldsRes.data.forEach((field) => {
        initialValues[field.name] = '';
      });
      setFieldValues(initialValues);
    }

    if (deptsRes.data) {
      setDepartments(deptsRes.data);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      file,
      name: file.name,
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !runName.trim() || !selectedDepartment) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.from('process_runs').insert({
        process_id: processId,
        field_values: {
          _run_name: runName.trim(),
          _initiator_department: selectedDepartment,
          ...fieldValues,
        },
        started_by: user.id,
        status: 'pending',
      }).select().single();

      if (error) throw error;

      // Upload files if any
      if (uploadedFiles.length > 0 && data) {
        for (const uploadedFile of uploadedFiles) {
          const filePath = `${data.id}/${Date.now()}-${uploadedFile.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('process-attachments')
            .upload(filePath, uploadedFile.file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('process-attachments')
              .getPublicUrl(filePath);

            await supabase.from('process_run_attachments').insert({
              process_run_id: data.id,
              file_name: uploadedFile.name,
              file_url: urlData.publicUrl,
              file_type: uploadedFile.file.type,
              uploaded_by: user.id,
            });
          }
        }
      }

      toast({ title: t('processStarted') });
      navigate(`/processes/runs/${data.id}`);
    } catch (error) {
      console.error('Error:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const updateFieldValue = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleIBANChange = (fieldName: string, value: string) => {
    const formatted = formatIBAN(value);
    updateFieldValue(fieldName, formatted);
  };

  const isIBANField = (fieldName: string) => {
    const lowerName = fieldName.toLowerCase();
    return lowerName.includes('iban') || lowerName.includes('ібан') || lowerName.includes('счет') || lowerName.includes('рахунок');
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
        // Check if field is IBAN type
        if (isIBANField(field.name)) {
          return (
            <Input
              value={fieldValues[field.name] || ''}
              onChange={(e) => handleIBANChange(field.name, e.target.value)}
              placeholder="UA00 0000 0000 0000 0000 0000 0000 0"
              className="font-mono"
            />
          );
        }
        return (
          <Input
            value={fieldValues[field.name] || ''}
            onChange={(e) => updateFieldValue(field.name, e.target.value)}
          />
        );
    }
  };

  const isValid = runName.trim() && selectedDepartment;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!process) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('processNotFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToProcesses')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/processes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('runProcess')}</h1>
          <p className="text-muted-foreground">{process.title}</p>
        </div>
      </div>

      {process.description && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium text-foreground mb-2">{t('processDescription')}</h3>
            <p className="text-sm text-muted-foreground">{process.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={addDepartment}>{t('add')}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingDept(false)}>{t('cancel')}</Button>
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
                  <Button type="button" size="icon" variant="outline" onClick={() => setIsAddingDept(true)}>
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

            {/* File attachments */}
            <div className="space-y-2">
              <Label>{t('attachments') || 'Вложения'}</Label>
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  {t('addFile') || 'Добавить файл'}
                </Button>
                
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/processes')}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting || !isValid}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {t('startProcess')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RunProcess;
