import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  updated_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export const useAIAssistant = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setConversations(data || []);
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setMessages((data as AIMessage[]) || []);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (currentId) {
      loadMessages(currentId);
    } else {
      setMessages([]);
    }
  }, [currentId, loadMessages]);

  const newConversation = useCallback(() => {
    setCurrentId(null);
    setMessages([]);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase.from('ai_conversations').delete().eq('id', id);
    if (error) {
      toast.error('Не удалось удалить диалог');
      return;
    }
    if (currentId === id) {
      setCurrentId(null);
      setMessages([]);
    }
    loadConversations();
  }, [currentId, loadConversations]);

  const sendMessage = useCallback(async (text: string) => {
    if (!user || !text.trim() || isStreaming) return;

    let convId = currentId;

    // Create conversation on first message
    if (!convId) {
      const title = text.length > 50 ? text.slice(0, 50) + '…' : text;
      const { data: conv, error } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title })
        .select('id')
        .single();
      if (error || !conv) {
        toast.error('Не удалось создать диалог');
        return;
      }
      convId = conv.id;
      setCurrentId(convId);
      loadConversations();
    }

    // Save user message
    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: text,
    });

    // Stream response
    setIsStreaming(true);
    const assistantMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, assistantMsg]);

    let accumulated = '';
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const historyForAPI = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ messages: historyForAPI }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Ошибка' }));
        if (resp.status === 429) toast.error('Превышен лимит запросов AI. Попробуйте позже.');
        else if (resp.status === 402) toast.error('Недостаточно кредитов AI.');
        else toast.error(err.error || 'Ошибка AI');
        setMessages((prev) => prev.slice(0, -1));
        setIsStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              accumulated += chunk;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: accumulated };
                return copy;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Save final assistant message
      if (accumulated) {
        await supabase.from('ai_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: accumulated,
        });
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);
        loadConversations();
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error(e);
        toast.error('Ошибка связи с AI');
      }
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [user, currentId, messages, isStreaming, loadConversations]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    conversations,
    currentId,
    messages,
    isStreaming,
    sendMessage,
    stop,
    newConversation,
    selectConversation,
    deleteConversation,
  };
};
