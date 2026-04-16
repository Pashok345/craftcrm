import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LOGO_URL = "https://iibqglmxhaiecueqbudh.supabase.co/storage/v1/object/public/avatars/email-logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailHeader = `
  <div style="text-align: center; margin-bottom: 32px;">
    <img src="${LOGO_URL}" alt="CRM Pro" style="max-width: 180px; height: auto;">
  </div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept both service_role key and anon JWT from pg_cron
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const expectedServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!expectedServiceKey || token !== expectedServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    console.log(`Checking tasks with deadline on ${tomorrowDate}`);

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, deadline, created_by, status')
      .eq('deadline', tomorrowDate)
      .neq('status', 'done');

    if (tasksError) throw tasksError;

    console.log(`Found ${tasks?.length || 0} tasks with upcoming deadlines`);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No tasks with upcoming deadlines" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailsSent: string[] = [];

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'todo': return 'До виконання';
        case 'in_progress': return 'В роботі';
        case 'review': return 'На перевірці';
        default: return status;
      }
    };

    for (const task of tasks) {
      const { data: assignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', task.id);

      const usersToNotify = new Set<string>();
      if (assignees) assignees.forEach(a => usersToNotify.add(a.user_id));
      if (task.created_by) usersToNotify.add(task.created_by);

      const userIds = Array.from(usersToNotify);
      if (userIds.length === 0) continue;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, name')
        .in('user_id', userIds);

      if (!profiles || profiles.length === 0) continue;

      for (const profile of profiles) {
        if (!profile.email) continue;

        try {
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'deadline',
            title: 'Наближається дедлайн завдання',
            message: `Завдання "${task.title}" має бути завершено завтра (${tomorrowDate})`,
            task_id: task.id,
          });

          const { error: emailError } = await resend.emails.send({
            from: "CRM <onboarding@resend.dev>",
            to: [profile.email],
            subject: `⏰ Нагадування: дедлайн завдання "${task.title}" завтра`,
            html: `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
              <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                  ${emailHeader}
                  <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">⏰</span></div>
                    <h1 style="color: #f59e0b; font-size: 24px; margin: 0 0 8px 0; text-align: center;">Наближається дедлайн!</h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">
                      Вітаємо, ${profile.name || 'колего'}! Нагадуємо про завдання.
                    </p>
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; border-left: 4px solid #f59e0b;">
                      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">${task.title}</h2>
                      <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 16px; margin-right: 8px;">📅</span>
                        <p style="color: #6b7280; margin: 0; font-size: 14px;"><strong>Дедлайн:</strong> ${tomorrowDate}</p>
                      </div>
                      <div style="display: flex; align-items: center;">
                        <span style="font-size: 16px; margin-right: 8px;">📋</span>
                        <p style="color: #6b7280; margin: 0; font-size: 14px;"><strong>Статус:</strong> ${getStatusLabel(task.status)}</p>
                      </div>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                      Термін виконання завдання закінчується завтра. Будь ласка, завершіть його вчасно.
                    </p>
                  </div>
                  <div style="text-align: center; margin-top: 32px;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Це автоматичне сповіщення з CRM системи</p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">© 2025 CRM Pro. Усі права захищено.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });

          if (emailError) {
            console.warn(`Email to ${profile.email} skipped (Resend):`, emailError);
          } else {
            emailsSent.push(profile.email);
          }
        } catch (sendError) {
          console.warn(`Failed to send to ${profile.email}:`, sendError);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${emailsSent.length} deadline reminder emails`, emails: emailsSent }),
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
