import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Завершена',
};

const projectStatusLabels: Record<string, string> = {
  planning: 'Планирование',
  active: 'Активный',
  on_hold: 'Приостановлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
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
      console.error('Invalid token:', userError);
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

    // Get emails for recipients
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('user_id, email, name')
      .in('user_id', recipient_user_ids);

    if (profilesError || !profiles || profiles.length === 0) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: "No recipients found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusLabels = entity_type === 'task' ? taskStatusLabels : projectStatusLabels;
    const oldStatusLabel = statusLabels[old_status] || old_status;
    const newStatusLabel = statusLabels[new_status] || new_status;
    const entityTypeLabel = entity_type === 'task' ? 'задачи' : 'проекта';
    const entityTypeTitle = entity_type === 'task' ? 'Задача' : 'Проект';
    const emoji = entity_type === 'task' ? '📋' : '📁';

    console.log(`Sending status change emails for ${entity_type} "${entity_title}" to ${profiles.length} recipients`);

    const emailsSent: string[] = [];

    for (const profile of profiles) {
      if (!profile.email) continue;

      try {
        // Create in-app notification
        await adminClient.from('notifications').insert({
          user_id: profile.user_id,
          type: 'status_change',
          title: `Статус ${entityTypeLabel} изменён`,
          message: `${changed_by_name} изменил статус ${entityTypeLabel} "${entity_title}": ${oldStatusLabel} → ${newStatusLabel}`,
          task_id: entity_type === 'task' ? entity_id : null,
          created_by: user.id,
        });

        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [profile.email],
          subject: `${emoji} Статус ${entityTypeLabel} "${entity_title}" изменён`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8b5cf6;">${emoji} Изменение статуса</h2>
              <div style="background-color: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
                <h3 style="color: #1a1a1a; margin-top: 0;">${entityTypeTitle}: ${entity_title}</h3>
                <p style="color: #666; margin: 12px 0;">
                  <strong>${changed_by_name}</strong> изменил статус:
                </p>
                <div style="display: flex; align-items: center; gap: 8px; margin: 16px 0;">
                  <span style="background-color: #e5e7eb; padding: 6px 12px; border-radius: 20px; font-size: 14px; color: #666;">
                    ${oldStatusLabel}
                  </span>
                  <span style="color: #666;">→</span>
                  <span style="background-color: #22c55e; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px;">
                    ${newStatusLabel}
                  </span>
                </div>
              </div>
              <p style="color: #666; font-size: 14px;">
                Здравствуйте, ${profile.name || 'пользователь'}! Вы получили это уведомление, так как являетесь участником данного ${entity_type === 'task' ? 'задачи' : 'проекта'}.
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
          console.log(`Status change email sent to ${profile.email}`);
        }
      } catch (sendError) {
        console.error(`Failed to send to ${profile.email}:`, sendError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Sent ${emailsSent.length} status change emails`,
        emails: emailsSent 
      }),
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
