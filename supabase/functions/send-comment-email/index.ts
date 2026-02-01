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

    const { task_id, task_title, comment_text, commenter_name, recipient_user_ids }: CommentEmailRequest = await req.json();

    if (!task_id || !recipient_user_ids || recipient_user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: taskData } = await adminClient
      .from('tasks')
      .select('created_by')
      .eq('id', task_id)
      .single();

    const { data: assigneeData } = await adminClient
      .from('task_assignees')
      .select('id')
      .eq('task_id', task_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (taskData?.created_by !== user.id && !assigneeData) {
      console.error('User not authorized for this task:', user.id);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log(`Sending comment emails for task "${task_title}" to ${profiles.length} recipients`);

    const emailsSent: string[] = [];
    const truncatedComment = comment_text.length > 200 ? comment_text.slice(0, 200) + '...' : comment_text;

    for (const profile of profiles) {
      if (!profile.email) continue;

      try {
        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [profile.email],
          subject: `💬 Новий коментар до завдання "${task_title}"`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 16px 24px; border-radius: 16px; margin-bottom: 16px;">
                    <span style="color: white; font-size: 28px; font-weight: bold;">CRM Pro</span>
                  </div>
                </div>
                
                <!-- Main Card -->
                <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 48px;">💬</span>
                  </div>
                  <h1 style="color: #3b82f6; font-size: 24px; margin: 0 0 8px 0; text-align: center;">
                    Новий коментар
                  </h1>
                  <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">
                    Вітаємо, ${profile.name || 'колего'}! У завданні є новий коментар.
                  </p>
                  
                  <!-- Task Card -->
                  <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 24px; border-left: 4px solid #3b82f6;">
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">
                      <strong>Завдання:</strong>
                    </p>
                    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">${task_title}</h2>
                    
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">
                      <strong>${commenter_name}</strong> залишив коментар:
                    </p>
                    
                    <div style="background-color: white; padding: 16px; border-radius: 8px; margin-top: 12px;">
                      <p style="color: #374151; margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${truncatedComment}</p>
                    </div>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                    Ви отримали це повідомлення, оскільки є учасником цього завдання.
                  </p>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 32px;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    Це автоматичне сповіщення з CRM системи
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
                    © 2024 CRM Pro. Усі права захищено.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        });

        if (emailError) {
          console.error(`Error sending email to ${profile.email}:`, emailError);
        } else {
          emailsSent.push(profile.email);
          console.log(`Comment email sent to ${profile.email}`);
        }
      } catch (sendError) {
        console.error(`Failed to send to ${profile.email}:`, sendError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Sent ${emailsSent.length} comment notification emails`,
        emails: emailsSent 
      }),
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
