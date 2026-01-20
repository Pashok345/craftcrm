import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": supabaseUrl,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization - only accept requests with service role key
    const authHeader = req.headers.get("Authorization");
    const expectedAuth = `Bearer ${supabaseServiceKey}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      console.log("Unauthorized request attempted");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tasks with deadlines tomorrow
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    console.log(`Checking tasks with deadline on ${tomorrowDate}`);

    // Get tasks with deadline tomorrow that are not done
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, deadline, created_by, status')
      .eq('deadline', tomorrowDate)
      .neq('status', 'done');

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} tasks with upcoming deadlines`);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No tasks with upcoming deadlines" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailsSent: string[] = [];

    for (const task of tasks) {
      // Get assignees for this task
      const { data: assignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', task.id);

      // Collect all users to notify (assignees + creator)
      const usersToNotify = new Set<string>();
      
      if (assignees) {
        assignees.forEach(a => usersToNotify.add(a.user_id));
      }
      
      if (task.created_by) {
        usersToNotify.add(task.created_by);
      }

      // Get emails for all users
      const userIds = Array.from(usersToNotify);
      if (userIds.length === 0) continue;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, name')
        .in('user_id', userIds);

      if (!profiles || profiles.length === 0) continue;

      console.log(`Sending deadline reminders for task "${task.title}" to ${profiles.length} users`);

      for (const profile of profiles) {
        if (!profile.email) continue;

        try {
          // Create in-app notification
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'deadline',
            title: 'Приближается дедлайн задачи',
            message: `Задача "${task.title}" должна быть завершена завтра (${tomorrowDate})`,
            task_id: task.id,
          });

          // Send email
          const { error: emailError } = await resend.emails.send({
            from: "CRM <onboarding@resend.dev>",
            to: [profile.email],
            subject: `⏰ Напоминание: дедлайн задачи "${task.title}" завтра`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">⏰ Приближается дедлайн</h2>
                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <h3 style="color: #1a1a1a; margin-top: 0;">${task.title}</h3>
                  <p style="color: #666; margin: 8px 0;">
                    <strong>Дедлайн:</strong> ${tomorrowDate}
                  </p>
                  <p style="color: #666; margin: 8px 0;">
                    <strong>Статус:</strong> ${task.status === 'todo' ? 'К выполнению' : task.status === 'in_progress' ? 'В работе' : task.status === 'review' ? 'На проверке' : task.status}
                  </p>
                </div>
                <p style="color: #666; font-size: 14px;">
                  Здравствуйте, ${profile.name || 'пользователь'}! Напоминаем, что срок выполнения задачи истекает завтра.
                </p>
                <p style="color: #888; font-size: 14px; margin-top: 20px;">
                  Это автоматическое уведомление из CRM системы.
                </p>
              </div>
            `,
          });

          if (emailError) {
            console.error(`Error sending email to ${profile.email}:`, emailError);
          } else {
            emailsSent.push(profile.email);
            console.log(`Deadline reminder sent to ${profile.email}`);
          }
        } catch (sendError) {
          console.error(`Failed to send to ${profile.email}:`, sendError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Sent ${emailsSent.length} deadline reminder emails`,
        emails: emailsSent 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-deadline-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
