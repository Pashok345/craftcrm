import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowDown, ArrowUp, Copy, Plus, Trash2, GripVertical,
  Type, AlignLeft, Hash, List, CircleDot, CheckSquare, Paperclip, User as UserIcon, MousePointerClick, Download, Upload, Loader2, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'file' | 'file_download' | 'user' | 'button';

export interface WorkflowField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  help?: string;
  assignee_user_id?: string | null;
  sample_url?: string | null;
  sample_name?: string | null;
  sample_path?: string | null;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  assignee_mode?: 'initiator' | 'user' | 'ask';
  assignee_id?: string | null;
  sla_hours?: number | null;
  fields: WorkflowField[];
}

interface Profile { user_id: string; name: string }

const FIELD_TYPE_META: Record<FieldType, { icon: any; labelKey: string; withOptions?: boolean }> = {
  text: { icon: Type, labelKey: 'fieldTypeText' },
  textarea: { icon: AlignLeft, labelKey: 'fieldTypeTextarea' },
  number: { icon: Hash, labelKey: 'fieldTypeNumber' },
  select: { icon: List, labelKey: 'fieldTypeSelect', withOptions: true },
  radio: { icon: CircleDot, labelKey: 'fieldTypeRadio', withOptions: true },
  checkbox: { icon: CheckSquare, labelKey: 'fieldTypeCheckbox', withOptions: true },
  file: { icon: Upload, labelKey: 'fieldTypeFileUpload' },
  file_download: { icon: Download, labelKey: 'fieldTypeFileDownload' },
  user: { icon: UserIcon, labelKey: 'fieldTypeUser' },
  button: { icon: MousePointerClick, labelKey: 'fieldTypeButton', withOptions: true },
};

const uid = () => Math.random().toString(36).slice(2, 10);

interface Props {
  value: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
}

export function WorkflowStepsEditor({ value, onChange }: Props) {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('user_id, name').order('name').then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  const steps = value;

  const updateStep = (idx: number, patch: Partial<WorkflowStep>) => {
    const copy = [...steps];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  const addStep = () => {
    onChange([
      ...steps,
      {
        id: uid(),
        title: `${t('step') || 'Крок'} ${steps.length + 1}`,
        description: '',
        sla_hours: null,
        fields: [],
      },
    ]);
  };


  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx));

  const moveStep = (idx: number, delta: -1 | 1) => {
    const to = idx + delta;
    if (to < 0 || to >= steps.length) return;
    const copy = [...steps];
    [copy[idx], copy[to]] = [copy[to], copy[idx]];
    onChange(copy);
  };

  const duplicateStep = (idx: number) => {
    const s = steps[idx];
    const copy = [...steps];
    copy.splice(idx + 1, 0, {
      ...s,
      id: uid(),
      title: `${s.title} (${t('copy') || 'копія'})`,
      fields: s.fields.map((f) => ({ ...f, id: uid() })),
    });
    onChange(copy);
  };

  const addField = (stepIdx: number, type: FieldType) => {
    const copy = [...steps];
    const defaultOptions = type === 'button'
      ? [
          t('buttonActionApprove') || 'Підтвердити',
          t('buttonActionReject') || 'Скасувати',
          t('buttonActionRevise') || 'На доопрацювання',
        ]
      : FIELD_TYPE_META[type].withOptions
        ? ['Варіант 1', 'Варіант 2']
        : undefined;
    copy[stepIdx] = {
      ...copy[stepIdx],
      fields: [
        ...copy[stepIdx].fields,
        {
          id: uid(),
          label: t(FIELD_TYPE_META[type].labelKey) || 'Поле',
          type,
          required: type === 'user' ? true : false,
          options: defaultOptions,
          assignee_user_id: type === 'user' ? null : undefined,
        },
      ],
    };
    onChange(copy);
  };


  const updateField = (stepIdx: number, fieldIdx: number, patch: Partial<WorkflowField>) => {
    const copy = [...steps];
    const fields = [...copy[stepIdx].fields];
    fields[fieldIdx] = { ...fields[fieldIdx], ...patch };
    copy[stepIdx] = { ...copy[stepIdx], fields };
    onChange(copy);
  };

  const removeField = (stepIdx: number, fieldIdx: number) => {
    const copy = [...steps];
    copy[stepIdx] = {
      ...copy[stepIdx],
      fields: copy[stepIdx].fields.filter((_, i) => i !== fieldIdx),
    };
    onChange(copy);
  };

  const moveField = (stepIdx: number, fieldIdx: number, delta: -1 | 1) => {
    const to = fieldIdx + delta;
    const fields = steps[stepIdx].fields;
    if (to < 0 || to >= fields.length) return;
    const copy = [...steps];
    const f = [...fields];
    [f[fieldIdx], f[to]] = [f[to], f[fieldIdx]];
    copy[stepIdx] = { ...copy[stepIdx], fields: f };
    onChange(copy);
  };

  return (
    <div className="space-y-4">
      {steps.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
          <p className="text-sm">
            {t('noWorkflowSteps') || 'Ще немає жодного кроку. Додайте перший крок робочого процесу.'}
          </p>
        </div>
      )}

      {steps.map((step, sIdx) => (
        <Card key={step.id} className="overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">
              {t('step') || 'Крок'} {sIdx + 1}
            </span>
            <div className="flex-1" />
            <Button size="icon" variant="ghost" onClick={() => moveStep(sIdx, -1)} disabled={sIdx === 0}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => moveStep(sIdx, 1)} disabled={sIdx === steps.length - 1}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => duplicateStep(sIdx)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeStep(sIdx)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <CardContent className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('stepName') || 'Назва кроку'}</Label>
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(sIdx, { title: e.target.value })}
                  placeholder={t('stepNamePlaceholder') || 'Наприклад, Підготувати документ'}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('deadlineHours') || 'Термін виконання (годин)'}</Label>
                <Input
                  type="number"
                  min={0}
                  value={step.sla_hours ?? ''}
                  onChange={(e) =>
                    updateStep(sIdx, { sla_hours: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="24"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('stepDescription') || 'Опис кроку'}</Label>
              <Textarea
                rows={2}
                value={step.description || ''}
                onChange={(e) => updateStep(sIdx, { description: e.target.value })}
                placeholder={t('stepDescriptionPlaceholder') || 'Що потрібно зробити на цьому кроці'}
              />
            </div>

            {/* Note: step responsible is now defined via a "Відповідальний" field */}


            {/* Fields */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('stepFields') || 'Поля кроку'}</Label>
              </div>

              {step.fields.map((field, fIdx) => {
                const meta = FIELD_TYPE_META[field.type];
                const Icon = meta.icon;
                return (
                  <div key={field.id} className="border rounded-md p-3 bg-background space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        className="flex-1"
                        value={field.label}
                        onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                        placeholder={t('fieldName') || 'Назва поля'}
                      />
                      <Select
                        value={field.type}
                        onValueChange={(v: FieldType) => {
                          const withOpts = FIELD_TYPE_META[v].withOptions;
                          updateField(sIdx, fIdx, {
                            type: v,
                            options: withOpts ? field.options || ['Варіант 1', 'Варіант 2'] : undefined,
                          });
                        }}
                      >
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((k) => (
                            <SelectItem key={k} value={k}>{t(FIELD_TYPE_META[k].labelKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => moveField(sIdx, fIdx, -1)} disabled={fIdx === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => moveField(sIdx, fIdx, 1)} disabled={fIdx === step.fields.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeField(sIdx, fIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {meta.withOptions && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">
                          {t('selectOptionsPlaceholder') || 'Варіанти (по одному в рядку)'}
                        </Label>
                        <Textarea
                          rows={2}
                          value={(field.options || []).join('\n')}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, {
                              options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                        />
                      </div>
                    )}

                    {field.type === 'user' && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">
                          {t('responsibleUser') || 'Відповідальний за крок'}
                        </Label>
                        <Select
                          value={field.assignee_user_id || ''}
                          onValueChange={(v) => updateField(sIdx, fIdx, { assignee_user_id: v })}
                        >
                          <SelectTrigger><SelectValue placeholder={t('selectUser') || 'Оберіть користувача'} /></SelectTrigger>
                          <SelectContent>
                            {profiles.map((p) => (
                              <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(c) => updateField(sIdx, fIdx, { required: c })}
                        />
                        <Label className="text-xs">{t('fieldRequired') || 'Обовʼязкове'}</Label>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((k) => {
                  const M = FIELD_TYPE_META[k];
                  const Icon = M.icon;
                  return (
                    <Button
                      key={k}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => addField(sIdx, k)}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1" />{t(M.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button onClick={addStep} variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />{t('addStep') || 'Додати крок'}
      </Button>
    </div>
  );
}
