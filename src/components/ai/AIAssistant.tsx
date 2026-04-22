import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Plus, Trash2, MessageSquare, Loader2, X, StopCircle, Paperclip, Image as ImageIcon, HelpCircle, ListTodo, Briefcase, Users, Calendar, BarChart3, AtSign, ImagePlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MentionInput } from '@/components/ui/mention-input';
import { ImageThumbnail } from '@/components/ui/image-lightbox';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

const MAX_FILES = 4;
const MAX_FILE_MB = 5;

export const AIAssistant = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    conversations,
    currentId,
    messages,
    isStreaming,
    sendMessage,
    stop,
    newConversation,
    selectConversation,
    deleteConversation,
  } = useAIAssistant();

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Cleanup object URLs on unmount or attachment change
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const addFiles = (files: File[]) => {
    const valid: { file: File; preview: string }[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        // skip oversize
        continue;
      }
      valid.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setAttachments((prev) => {
      const merged = [...prev, ...valid].slice(0, MAX_FILES);
      // revoke any dropped previews
      [...prev, ...valid].slice(MAX_FILES).forEach((a) => URL.revokeObjectURL(a.preview));
      return merged;
    });
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    const files = attachments.map((a) => a.file);
    // Cleanup previews after sending
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setInput('');
    setAttachments([]);
    sendMessage(text, files);
  };

  const placeholder = {
    ru: 'Спросите AI… @имя — упомянуть сотрудника',
    en: 'Ask AI… @name — mention a teammate',
    uk: 'Запитайте AI… @ім\'я — згадати співробітника',
  }[language];

  const titles = {
    ru: { title: 'AI-ассистент', new: 'Новый диалог', history: 'История', empty: 'Пока нет диалогов', greet: 'Чем помочь?', hint: 'Я могу помочь с задачами, проектами, текстами. Прикрепляйте скриншоты и используйте @ для упоминания сотрудников.', attach: 'Прикрепить изображение', help: 'Возможности ассистента' },
    en: { title: 'AI Assistant', new: 'New chat', history: 'History', empty: 'No conversations yet', greet: 'How can I help?', hint: 'I can help with tasks, projects, and texts. Attach screenshots and use @ to mention teammates.', attach: 'Attach image', help: 'Assistant capabilities' },
    uk: { title: 'AI-асистент', new: 'Новий діалог', history: 'Історія', empty: 'Поки немає діалогів', greet: 'Чим допомогти?', hint: 'Я можу допомогти із завданнями, проєктами, текстами. Прикріпляйте скріншоти та використовуйте @ для згадки співробітників.', attach: 'Прикріпити зображення', help: 'Можливості асистента' },
  }[language];

  const capabilities = {
    ru: {
      heading: 'Что я умею',
      subtitle: 'Спросите естественным языком — я разберусь',
      groups: [
        { icon: ListTodo, title: 'Задачи', items: ['Поиск по статусу, дедлайну, исполнителю', 'Мои задачи на сегодня', 'Создание задач: «создай задачу...»'] },
        { icon: Briefcase, title: 'Сделки', items: ['Воронка продаж и суммы', 'Прогноз выручки', 'Активные сделки по этапам'] },
        { icon: Users, title: 'Клиенты', items: ['Поиск клиентов и контактов', 'История взаимодействий', 'Создание клиента: «добавь клиента...»'] },
        { icon: Calendar, title: 'Встречи', items: ['Расписание на день/неделю', 'Создание встреч с участниками', 'Автоуведомления участникам'] },
        { icon: BarChart3, title: 'Аналитика', items: ['Сводки по команде и продуктивность', 'Сводка по проекту'] },
        { icon: AtSign, title: 'Упоминания', items: ['Введите @ чтобы упомянуть сотрудника', 'Я найду его в базе и привяжу'] },
        { icon: ImagePlus, title: 'Изображения', items: ['Прикрепите до 4 скриншотов (≤5 МБ)', 'Вставка из буфера: Ctrl+V'] },
      ],
    },
    en: {
      heading: 'What I can do',
      subtitle: 'Ask in natural language — I’ll figure it out',
      groups: [
        { icon: ListTodo, title: 'Tasks', items: ['Search by status, deadline, assignee', 'My tasks for today', 'Create tasks: “create a task...”'] },
        { icon: Briefcase, title: 'Deals', items: ['Sales funnel and totals', 'Revenue forecast', 'Active deals by stage'] },
        { icon: Users, title: 'Clients', items: ['Search clients and contacts', 'Interaction history', 'Create client: “add a client...”'] },
        { icon: Calendar, title: 'Meetings', items: ['Schedule for day/week', 'Create meetings with participants', 'Auto-notifications to attendees'] },
        { icon: BarChart3, title: 'Analytics', items: ['Team summaries & productivity', 'Project summary'] },
        { icon: AtSign, title: 'Mentions', items: ['Type @ to mention a teammate', 'I’ll find them in the database'] },
        { icon: ImagePlus, title: 'Images', items: ['Attach up to 4 screenshots (≤5 MB)', 'Paste from clipboard: Ctrl+V'] },
      ],
    },
    uk: {
      heading: 'Що я вмію',
      subtitle: 'Запитайте природною мовою — я розберуся',
      groups: [
        { icon: ListTodo, title: 'Завдання', items: ['Пошук за статусом, дедлайном, виконавцем', 'Мої завдання на сьогодні', 'Створення: «створи завдання...»'] },
        { icon: Briefcase, title: 'Угоди', items: ['Воронка продажів і суми', 'Прогноз виручки', 'Активні угоди за етапами'] },
        { icon: Users, title: 'Клієнти', items: ['Пошук клієнтів і контактів', 'Історія взаємодій', 'Створення: «додай клієнта...»'] },
        { icon: Calendar, title: 'Зустрічі', items: ['Розклад на день/тиждень', 'Створення зустрічей з учасниками', 'Автосповіщення учасникам'] },
        { icon: BarChart3, title: 'Аналітика', items: ['Зведення по команді та продуктивність', 'Зведення по проєкту'] },
        { icon: AtSign, title: 'Згадки', items: ['Введіть @ щоб згадати співробітника', 'Я знайду його в базі'] },
        { icon: ImagePlus, title: 'Зображення', items: ['Прикріпіть до 4 скріншотів (≤5 МБ)', 'Вставка з буфера: Ctrl+V'] },
      ],
    },
  }[language];

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform bg-gradient-to-br from-primary to-primary/80"
        aria-label={titles.title}
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0 pr-12">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <SheetTitle className="truncate">{titles.title}</SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory((v) => !v)}
                className="h-8 w-8"
                title={titles.history}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={newConversation}
                className="h-8 w-8"
                title={titles.new}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* History panel */}
          {showHistory && (
            <div className="border-b bg-muted/30 max-h-64 overflow-hidden flex flex-col">
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{titles.history}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowHistory(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 py-3">{titles.empty}</p>
                ) : (
                  <div className="px-2 pb-2 space-y-1">
                    {conversations.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
                          currentId === c.id && 'bg-accent'
                        )}
                        onClick={() => {
                          selectConversation(c.id);
                          setShowHistory(false);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{c.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: dateLocale })}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(c.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{titles.greet}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">{titles.hint}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2 text-sm space-y-2',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      )}
                    >
                      {m.images && m.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {m.images.map((url, i) => (
                            <ImageThumbnail key={i} src={url} alt={`attachment-${i}`} />
                          ))}
                        </div>
                      )}
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 break-words">
                          {m.content ? (
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          ) : isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                        </div>
                      ) : (
                        m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="border-t px-3 py-2 flex flex-wrap gap-2 bg-muted/30">
              {attachments.map((a, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={a.preview}
                    alt={`preview-${idx}`}
                    className="h-16 w-16 object-cover rounded-md border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-90 hover:opacity-100"
                    aria-label="remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilePick}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="icon"
                variant="ghost"
                className="shrink-0 h-10 w-10"
                title={titles.attach}
                disabled={isStreaming || attachments.length >= MAX_FILES}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <MentionInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                onPasteImage={(file) => addFiles([file])}
                placeholder={placeholder}
                variant="textarea"
                disabled={isStreaming}
                className="min-h-[40px] max-h-32"
              />
              {isStreaming ? (
                <Button onClick={stop} size="icon" variant="outline" className="shrink-0 h-10 w-10">
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  size="icon"
                  disabled={!input.trim() && attachments.length === 0}
                  className="shrink-0 h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
