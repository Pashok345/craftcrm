import { supabase } from '@/integrations/supabase/client';
import { containsAIMention } from '@/components/ui/mention-input';
import { toast } from 'sonner';

export type AICommentEntityType = 'task' | 'deal' | 'proposal' | 'process_run';

/**
 * If comment text contains an @AI mention, ask the AI to reply
 * and insert its answer as a new comment in the same thread.
 * Returns true if AI was invoked.
 */
export async function maybeInvokeCommentAI(
  text: string,
  entity_type: AICommentEntityType,
  entity_id: string
): Promise<boolean> {
  if (!containsAIMention(text)) return false;

  try {
    const { data, error } = await supabase.functions.invoke('comment-ai', {
      body: { entity_type, entity_id, question: text },
    });
    if (error) {
      console.error('AI comment error:', error);
      toast.error('AI не смог ответить. Попробуйте позже.');
      return false;
    }
    if (data?.error) {
      toast.error(data.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('AI comment exception:', e);
    return false;
  }
}
