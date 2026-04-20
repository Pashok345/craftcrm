import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Sparkles, Send, Plus, Trash2, MessageSquare, Loader2, X, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

export const AIAssistant = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, currentId]);

  if (!user) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = {
    ru: 'Спросите AI… (например: «Сделай саммари проекта Лендинг»)',
    en: 'Ask AI… (e.g. "Summarize the Landing project")',
    uk: 'Запитайте AI… (наприклад: «Зроби саммарі проєкту Лендинг»)',
  }[language];

  const titles = {
    ru: { title: 'AI-ассистент', new: 'Новый диалог', history: 'История', empty: 'Пока нет диалогов', greet: 'Чем помочь?', hint: 'Я могу помочь с задачами, проектами, текстами. Попросите саммари проекта — я подтяну актуальные данные.' },
    en: { title: 'AI Assistant', new: 'New chat', history: 'History', empty: 'No conversations yet', greet: 'How can I help?', hint: 'I can help with tasks, projects, and texts. Ask me to summarize a project — I will pull live data.' },
    uk: { title: 'AI-асистент', new: 'Новий діалог', history: 'Історія', empty: 'Поки немає діалогів', greet: 'Чим допомогти?', hint: 'Я можу допомогти із завданнями, проєктами, текстами. Попросіть саммарі проєкту — я підтягну актуальні дані.' },
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
                        'max-w-[85%] rounded-2xl px-4 py-2 text-sm',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 break-words">
                          {m.content ? (
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          ) : isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-3 space-y-2">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={placeholder}
                rows={1}
                className="min-h-[40px] max-h-32 resize-none"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button onClick={stop} size="icon" variant="outline" className="shrink-0">
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSend} size="icon" disabled={!input.trim()} className="shrink-0">
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
