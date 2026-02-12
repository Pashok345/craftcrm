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

const emailHeader = `
  <div style="text-align: center; margin-bottom: 32px;">
    <img src="${LOGO_URL}" alt="CRM Pro" style="max-width: 180px; height: auto;">
  </div>`;

interface NotificationEmailRequest {
  user_id: string;
  type: 'welcome' | 'notification';
  title: string;
  message: string;
  task_id?: string;
}

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

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentUserId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { user_id, type, title, message, task_id }: NotificationEmailRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization checks
    if (task_id) {
      const { data: taskRelation } = await adminClient
        .from('tasks')
        .select('id, created_by')
        .eq('id', task_id)
        .single();
      
      const { data: assigneeRelation } = await adminClient
        .from('task_assignees')
        .select('id')
        .eq('task_id', task_id)
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      const isTaskRelated = taskRelation?.created_by === currentUserId || !!assigneeRelation;
      
      if (!isTaskRelated) {
        const { data: roleData } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUserId)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (!roleData) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('user_id', user_id)
      .single();

    if (profileError || !profile?.email) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = '';
    let htmlContent = '';

    if (type === 'welcome') {
      subject = 'Ласкаво просимо до CRM системи!';
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            ${emailHeader}
            <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">🎉</span></div>
              <h1 style="color: #22c55e; font-size: 24px; margin: 0 0 8px 0; text-align: center;">Ласкаво просимо!</h1>
              <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0; text-align: center;">Вітаємо, ${profile.name || 'колего'}!</p>
              <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; border-left: 4px solid #22c55e;">
                <p style="color: #374151; margin: 0 0 8px 0;">Ваш акаунт у CRM системі успішно створено.</p>
                <p style="color: #374151; margin: 0;">Тепер ви можете увійти в систему та розпочати роботу.</p>
              </div>
            </div>
            <div style="text-align: center; margin-top: 32px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Якщо у вас виникнуть питання, зверніться до адміністратора.</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">© 2025 CRM Pro. Усі права захищено.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = title || 'Нове сповіщення';
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            ${emailHeader}
            <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">🔔</span></div>
              <h1 style="color: #3b82f6; font-size: 24px; margin: 0 0 8px 0; text-align: center;">${title}</h1>
              <div style="background-color: #eff6ff; border-radius: 12px; padding: 24px; margin-top: 24px; border-left: 4px solid #3b82f6;">
                <p style="color: #374151; margin: 0;">${message}</p>
              </div>
            </div>
            <div style="text-align: center; margin-top: 32px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Це автоматичне сповіщення з CRM системи</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">© 2025 CRM Pro. Усі права захищено.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const { error: emailError } = await resend.emails.send({
      from: "CRM <onboarding@resend.dev>",
      to: [profile.email],
      subject: subject,
      html: htmlContent,
    });

    if (emailError) {
      // Graceful: log warning but return success so UI doesn't break
      console.warn('Email sending skipped (Resend):', emailError);
      return new Response(
        JSON.stringify({ success: true, email: profile.email, email_sent: false, warning: 'Email delivery restricted by Resend domain settings' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent to ${profile.email}`);
    return new Response(
      JSON.stringify({ success: true, email: profile.email, email_sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
