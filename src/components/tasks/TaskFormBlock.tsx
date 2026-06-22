import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, X, Save, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type FormQuestionType =
  | 'short_text'
  | 'long_text'
  | 'single'
  | 'multiple'
  | 'dropdown'
  | 'date'
  | 'scale';

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  title: string;
  options?: string[];
  required?: boolean;
}

export interface FormContent {
  title?: string;
  description?: string;
  questions: FormQuestion[];
}

const TYPE_LABELS: Record<FormQuestionType, string> = {
  short_text: 'Текст (строка)',
  long_text: 'Текст (абзац)',
  single: 'Один из списка',
  multiple: 'Несколько из списка',
  dropdown: 'Выпадающий список',
  date: 'Дата',
  scale: 'Шкала 1-10',
};

const newQuestion = (type: FormQuestionType = 'short_text'): FormQuestion => ({
  id: crypto.randomUUID(),
  type,
  title: '',
  options: type === 'single' || type === 'multiple' || type === 'dropdown' ? ['Вариант 1'] : undefined,
  required: false,
});

interface Props {
  blockId: string;
  taskId: string;
  content: FormContent;
  canEdit: boolean;
  onChange: (next: FormContent) => void;
}

export const TaskFormBlock = ({ blockId, taskId, content, canEdit, onChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FormContent>(content);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [myResponseId, setMyResponseId] = useState<string | null>(null);
  const [responsesCount, setResponsesCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [allResponses, setAllResponses] = useState<any[]>([]);

  useEffect(() => setDraft(content), [content]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, count } = await supabase
        .from('task_form_responses')
        .select('*', { count: 'exact' })
        .eq('block_id', blockId);
      setResponsesCount(count || 0);
      const mine = (data || []).find((r: any) => r.user_id === user.id);
      if (mine) {
        setMyResponseId(mine.id);
        setAnswers(mine.answers || {});
      }
      setAllResponses(data || []);
    })();
  }, [blockId, user?.id]);

  const saveStructure = () => {
    onChange(draft);
    setEditing(false);
  };

  const updateQuestion = (qid: string, patch: Partial<FormQuestion>) => {
    setDraft(d => ({ ...d, questions: d.questions.map(q => q.id === qid ? { ...q, ...patch } : q) }));
  };

  const submitAnswers = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (myResponseId) {
        const { error } = await supabase
          .from('task_form_responses')
          .update({ answers })
          .eq('id', myResponseId);
        if (error) throw error;
        toast({ title: 'Ответы обновлены' });
      } else {
        const { data, error } = await supabase
          .from('task_form_responses')
          .insert({ block_id: blockId, task_id: taskId, user_id: user.id, answers })
          .select()
          .single();
        if (error) throw error;
        setMyResponseId(data.id);
        setResponsesCount(c => c + 1);
        toast({ title: 'Ответ отправлен' });
      }
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (editing && canEdit) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Название формы"
            value={draft.title || ''}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="text-lg font-medium"
          />
          <Textarea
            placeholder="Описание (необязательно)"
            value={draft.description || ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
          />
        </div>

        <div className="space-y-3">
          {draft.questions.map((q, idx) => (
            <div key={q.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex gap-2 items-start">
                <span className="text-xs text-muted-foreground mt-2">{idx + 1}.</span>
                <Input
                  placeholder="Вопрос"
                  value={q.title}
                  onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                  className="flex-1"
                />
                <Select
                  value={q.type}
                  onValueChange={(v) => updateQuestion(q.id, {
                    type: v as FormQuestionType,
                    options: (v === 'single' || v === 'multiple' || v === 'dropdown')
                      ? (q.options && q.options.length ? q.options : ['Вариант 1'])
                      : undefined,
                  })}
                >
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon"
                  onClick={() => setDraft(d => ({ ...d, questions: d.questions.filter(x => x.id !== q.id) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {(q.type === 'single' || q.type === 'multiple' || q.type === 'dropdown') && (
                <div className="space-y-1 pl-6">
                  {(q.options || []).map((opt, oi) => (
                    <div key={oi} className="flex gap-2 items-center">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...(q.options || [])];
                          next[oi] = e.target.value;
                          updateQuestion(q.id, { options: next });
                        }}
                      />
                      <Button variant="ghost" size="icon"
                        onClick={() => updateQuestion(q.id, { options: (q.options || []).filter((_, i) => i !== oi) })}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm"
                    onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `Вариант ${(q.options?.length || 0) + 1}`] })}>
                    <Plus className="h-3 w-3 mr-1" /> Добавить вариант
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 pl-6">
                <Checkbox checked={!!q.required}
                  onCheckedChange={(c) => updateQuestion(q.id, { required: !!c })} />
                <Label className="text-xs">Обязательный</Label>
              </div>
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            {(['short_text','long_text','single','multiple','dropdown','date','scale'] as FormQuestionType[]).map(t => (
              <Button key={t} variant="outline" size="sm"
                onClick={() => setDraft(d => ({ ...d, questions: [...d.questions, newQuestion(t)] }))}>
                <Plus className="h-3 w-3 mr-1" /> {TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setDraft(content); setEditing(false); }}>Отмена</Button>
          <Button onClick={saveStructure}><Save className="h-4 w-4 mr-2" />Сохранить форму</Button>
        </div>
      </div>
    );
  }

  const setAns = (qid: string, val: any) => setAnswers(a => ({ ...a, [qid]: val }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          {content.title && <h3 className="text-lg font-semibold">{content.title}</h3>}
          {content.description && <p className="text-sm text-muted-foreground mt-1">{content.description}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setShowResults(s => !s)}>
              Ответов: {responsesCount}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Редактировать</Button>
          </div>
        )}
      </div>

      {showResults && canEdit ? (
        <div className="space-y-3">
          {allResponses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ответов пока нет</p>
          ) : allResponses.map((r) => (
            <div key={r.id} className="border rounded p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-2">
                {new Date(r.created_at).toLocaleString('ru')}
              </div>
              {content.questions.map((q, i) => (
                <div key={q.id} className="mb-1">
                  <span className="font-medium">{i+1}. {q.title}: </span>
                  <span>{Array.isArray(r.answers?.[q.id]) ? r.answers[q.id].join(', ') : (r.answers?.[q.id] ?? '—')}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {content.questions.length === 0 && (
            <p className="text-sm text-muted-foreground">Форма пуста. {canEdit && 'Нажмите "Редактировать" для добавления вопросов.'}</p>
          )}
          {content.questions.map((q, i) => (
            <div key={q.id} className="space-y-1.5">
              <Label className="text-sm">
                {i+1}. {q.title} {q.required && <span className="text-destructive">*</span>}
              </Label>
              {q.type === 'short_text' && (
                <Input value={answers[q.id] || ''} onChange={(e) => setAns(q.id, e.target.value)} />
              )}
              {q.type === 'long_text' && (
                <Textarea value={answers[q.id] || ''} onChange={(e) => setAns(q.id, e.target.value)} rows={3} />
              )}
              {q.type === 'single' && (
                <RadioGroup value={answers[q.id] || ''} onValueChange={(v) => setAns(q.id, v)}>
                  {(q.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} id={`${q.id}-${oi}`} />
                      <Label htmlFor={`${q.id}-${oi}`} className="font-normal cursor-pointer">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {q.type === 'multiple' && (
                <div className="space-y-1">
                  {(q.options || []).map((opt, oi) => {
                    const arr: string[] = answers[q.id] || [];
                    return (
                      <div key={oi} className="flex items-center gap-2">
                        <Checkbox
                          checked={arr.includes(opt)}
                          onCheckedChange={(c) => setAns(q.id, c ? [...arr, opt] : arr.filter(x => x !== opt))}
                        />
                        <Label className="font-normal cursor-pointer">{opt}</Label>
                      </div>
                    );
                  })}
                </div>
              )}
              {q.type === 'dropdown' && (
                <Select value={answers[q.id] || ''} onValueChange={(v) => setAns(q.id, v)}>
                  <SelectTrigger><SelectValue placeholder="Выберите..." /></SelectTrigger>
                  <SelectContent>
                    {(q.options || []).map((opt, oi) => (
                      <SelectItem key={oi} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {q.type === 'date' && (
                <Input type="date" value={answers[q.id] || ''} onChange={(e) => setAns(q.id, e.target.value)} />
              )}
              {q.type === 'scale' && (
                <Input type="number" min={1} max={10} value={answers[q.id] || ''} onChange={(e) => setAns(q.id, Number(e.target.value))} />
              )}
            </div>
          ))}
          {content.questions.length > 0 && (
            <Button onClick={submitAnswers} disabled={submitting}>
              <Send className="h-4 w-4 mr-2" />
              {myResponseId ? 'Обновить ответ' : 'Отправить'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
