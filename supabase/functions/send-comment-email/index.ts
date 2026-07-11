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

interface CommentEmailRequest {
  task_id: string;
  task_title: string;
  comment_text: string;
  commenter_name: string;
  recipient_user_ids: string[];
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = { id: claimsData.claims.sub as string };

    const body = await req.json();
    const { task_id, recipient_user_ids: requestedRecipients, comment_id } = body as CommentEmailRequest & { comment_id?: string };

    if (!task_id || !requestedRecipients || requestedRecipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch task title from DB (don't trust client)
    const { data: taskData } = await adminClient
      .from('tasks')
      .select('created_by, title')
      .eq('id', task_id)
      .single();

    if (!taskData) {
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: assigneeData } = await adminClient
      .from('task_assignees')
      .select('id')
      .eq('task_id', task_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (taskData.created_by !== user.id && !assigneeData) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build verified recipient set: task creator + all assignees
    const { data: allAssignees } = await adminClient
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', task_id);
    const allowedRecipients = new Set<string>([taskData.created_by, ...(allAssignees?.map(a => a.user_id) ?? [])]);
    const recipient_user_ids = requestedRecipients.filter(id => allowedRecipients.has(id));

    if (recipient_user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid recipients' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Derive commenter name from auth-verified user
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle();

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

    const emailsSent: string[] = [];
    const safeTaskTitle = escapeHtml(taskData.title || '');
    const safeCommenterName = escapeHtml(callerProfile?.name || 'Колега');
    const rawComment = comment_text?.length > 200 ? comment_text.slice(0, 200) + '...' : (comment_text || '');
    const safeComment = escapeHtml(rawComment);

    for (const profile of profiles) {
      if (!profile.email) continue;

      try {
        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [profile.email],
          subject: `💬 Новий коментар до завдання "${safeTaskTitle}"`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                ${emailHeader}
                <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">💬</span></div>
                  <h1 style="color: #3b82f6; font-size: 24px; margin: 0 0 8px 0; text-align: center;">Новий коментар</h1>
                  <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">
                    Вітаємо, ${escapeHtml(profile.name || 'колего')}! У завданні є новий коментар.
                  </p>
                  <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 24px; border-left: 4px solid #3b82f6;">
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;"><strong>Завдання:</strong></p>
                    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">${safeTaskTitle}</h2>
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;"><strong>${safeCommenterName}</strong> залишив коментар:</p>
                    <div style="background-color: white; padding: 16px; border-radius: 8px; margin-top: 12px;">
                      <p style="color: #374151; margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${safeComment}</p>
                    </div>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                    Ви отримали це повідомлення, оскільки є учасником цього завдання.
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
      JSON.stringify({ success: true, message: `Sent ${emailsSent.length} comment notification emails`, emails: emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-comment-email function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
