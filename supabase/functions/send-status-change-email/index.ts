import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const LOGO_URL = "https://iibqglmxhaiecueqbudh.supabase.co/storage/v1/object/public/avatars/email-logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const emailHeader = `
  <div style="text-align: center; margin-bottom: 32px;">
    <img src="${LOGO_URL}" alt="CRM Pro" style="max-width: 180px; height: auto;">
  </div>`;

interface StatusChangeRequest {
  entity_type: 'task' | 'project';
  entity_id: string;
  entity_title: string;
  old_status: string;
  new_status: string;
  changed_by_name: string;
  recipient_user_ids: string[];
}

const taskStatusLabels: Record<string, string> = {
  todo: 'До виконання', in_progress: 'В роботі', review: 'На перевірці', done: 'Виконано',
};

const projectStatusLabels: Record<string, string> = {
  planning: 'Планування', active: 'Активний', on_hold: 'Призупинено', completed: 'Завершено', cancelled: 'Скасовано',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { entity_type, entity_id, entity_title, old_status, new_status, changed_by_name, recipient_user_ids }: StatusChangeRequest = await req.json();

    if (!entity_type || !entity_id || !recipient_user_ids || recipient_user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization: caller must own/be related to the entity, or be admin
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!roleData;

    if (!isAdmin) {
      let allowed = false;
      if (entity_type === 'task') {
        const { data: t } = await adminClient.from('tasks').select('created_by').eq('id', entity_id).maybeSingle();
        if (t?.created_by === user.id) allowed = true;
        if (!allowed) {
          const { data: a } = await adminClient.from('task_assignees').select('id').eq('task_id', entity_id).eq('user_id', user.id).maybeSingle();
          if (a) allowed = true;
        }
      } else if (entity_type === 'project') {
        const { data: p } = await adminClient.from('projects').select('created_by, manager_id').eq('id', entity_id).maybeSingle();
        if (p && (p.created_by === user.id || p.manager_id === user.id)) allowed = true;
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: profiles } = await adminClient
      .from('profiles')
      .select('user_id, email, name')
      .in('user_id', recipient_user_ids);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusLabels = entity_type === 'task' ? taskStatusLabels : projectStatusLabels;
    const oldStatusLabel = statusLabels[old_status] || old_status;
    const newStatusLabel = statusLabels[new_status] || new_status;
    const entityTypeLabel = entity_type === 'task' ? 'завдання' : 'проекту';
    const entityTypeTitle = entity_type === 'task' ? 'Завдання' : 'Проект';
    const emoji = entity_type === 'task' ? '📋' : '📁';

    const safeEntityTitle = escapeHtml(entity_title || '');
    const safeChangedByName = escapeHtml(changed_by_name || '');
    const safeOldStatus = escapeHtml(oldStatusLabel);
    const safeNewStatus = escapeHtml(newStatusLabel);

    const emailsSent: string[] = [];

    for (const profile of profiles) {
      if (!profile.email) continue;

      try {
        await adminClient.from('notifications').insert({
          user_id: profile.user_id,
          type: 'status_change',
          title: `Статус ${entityTypeLabel} змінено`,
          message: `${safeChangedByName} змінив статус ${entityTypeLabel} "${safeEntityTitle}": ${safeOldStatus} → ${safeNewStatus}`,
          task_id: entity_type === 'task' ? entity_id : null,
          created_by: user.id,
        });

        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [profile.email],
          subject: `${emoji} Статус ${entityTypeLabel} "${safeEntityTitle}" змінено`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                ${emailHeader}
                <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">${emoji}</span></div>
                  <h1 style="color: #8b5cf6; font-size: 24px; margin: 0 0 8px 0; text-align: center;">Зміна статусу</h1>
                  <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">Вітаємо, ${escapeHtml(profile.name || 'колего')}!</p>
                  <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-radius: 12px; padding: 24px; border-left: 4px solid #8b5cf6;">
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">${entityTypeTitle}:</p>
                    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">${safeEntityTitle}</h2>
                    <p style="color: #6b7280; margin: 0 0 16px 0; font-size: 14px;"><strong>${safeChangedByName}</strong> змінив статус:</p>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                      <span style="background-color: #e5e7eb; padding: 8px 16px; border-radius: 20px; font-size: 14px; color: #6b7280;">${safeOldStatus}</span>
                      <span style="color: #6b7280; font-size: 20px;">→</span>
                      <span style="background-color: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">${safeNewStatus}</span>
                    </div>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                    Ви отримали це повідомлення як учасник ${entity_type === 'task' ? 'цього завдання' : 'цього проекту'}.
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

    return new Response(
      JSON.stringify({ success: true, message: `Sent ${emailsSent.length} status change emails`, emails: emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-status-change-email function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
