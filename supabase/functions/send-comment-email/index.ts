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
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the JWT token and get user
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

    // Use service role for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is related to the task (creator or assignee)
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

    console.log(`Sending comment emails for task "${task_title}" to ${profiles.length} recipients`);

    const emailsSent: string[] = [];
    const truncatedComment = comment_text.length > 200 ? comment_text.slice(0, 200) + '...' : comment_text;

    for (const profile of profiles) {
      if (!profile.email) continue;

      try {
        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [profile.email],
          subject: `💬 Новий коментар до задачі "${task_title}"`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">💬 Новий коментар</h2>
              <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1a1a1a; margin-top: 0;">Задача: ${task_title}</h3>
                <p style="color: #666; margin: 8px 0;">
                  <strong>${commenter_name}</strong> залишив коментар:
                </p>
                <div style="background-color: #fff; padding: 12px; border-radius: 6px; margin-top: 12px;">
                  <p style="color: #333; margin: 0; white-space: pre-wrap;">${truncatedComment}</p>
                </div>
              </div>
              <p style="color: #666; font-size: 14px;">
                Вітаємо, ${profile.name || 'користувач'}! Ви отримали це повідомлення, оскільки є учасником цієї задачі.
              </p>
              <p style="color: #888; font-size: 14px; margin-top: 20px;">
                Це автоматичне повідомлення з CRM системи.
              </p>
            </div>
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
