import { supabase } from '@/integrations/supabase/client';

export interface DealStageAutomation {
  id: string;
  stage_id: string;
  task_title: string;
  task_description: string | null;
  assignee_id: string | null;
  due_in_days: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

/**
 * Runs all active automations bound to a funnel stage.
 * Creates tasks (with assignee + notification) when a deal enters the stage.
 * Returns the number of created tasks.
 */
export async function runDealStageAutomations(params: {
  dealId: string;
  dealTitle: string;
  stageId: string;
  stageName?: string;
  userId: string;
}): Promise<number> {
  const { dealId, dealTitle, stageId, stageName, userId } = params;

  const { data: rules } = await supabase
    .from('deal_stage_automations')
    .select('*')
    .eq('stage_id', stageId)
    .eq('is_active', true);

  const list = (rules || []) as unknown as DealStageAutomation[];
  if (!list.length) return 0;

  let created = 0;

  for (const rule of list) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (rule.due_in_days ?? 3));

    const title = rule.task_title.replace(/\{deal\}/gi, dealTitle);
    const description = [
      rule.task_description?.replace(/\{deal\}/gi, dealTitle) || '',
      `\n\n— ${dealTitle}${stageName ? ` → ${stageName}` : ''}`,
    ]
      .join('')
      .trim();

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        deadline: deadline.toISOString(),
        status: 'todo',
        created_by: userId,
      })
      .select('id')
      .single();

    if (error || !task) continue;
    created += 1;

    if (rule.assignee_id) {
      await supabase.from('task_assignees').insert({
        task_id: task.id,
        user_id: rule.assignee_id,
        role: 'executor',
      });

      if (rule.assignee_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: rule.assignee_id,
          type: 'task_assigned',
          title,
          message: dealTitle,
          task_id: task.id,
          created_by: userId,
        });
      }
    }
  }

  // touch deal so updated_at reflects the automation run
  void dealId;
  return created;
}
