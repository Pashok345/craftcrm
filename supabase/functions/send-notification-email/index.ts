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

interface NotificationEmailRequest {
  user_id: string;
  type: 'welcome' | 'notification';
  title: string;
  message: string;
  task_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    const currentUserId = user.id;
    
    // Use service role for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { user_id, type, title, message, task_id }: NotificationEmailRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization check: user can send notifications related to their tasks
    // or must be admin to send arbitrary notifications
    if (task_id) {
      // Check if current user is related to the task (creator or assignee)
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
        // Check if admin
        const { data: roleData } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUserId)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (!roleData) {
          console.error('User not authorized to send this notification');
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      // For non-task notifications, require admin role
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUserId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!roleData) {
        console.error('User is not admin:', currentUserId);
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get user email
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('user_id', user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = '';
    let htmlContent = '';

    if (type === 'welcome') {
      subject = 'Добро пожаловать в CRM систему!';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Добро пожаловать, ${profile.name || 'пользователь'}!</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; margin: 8px 0;">
              Ваш аккаунт в CRM системе успешно создан.
            </p>
            <p style="color: #666; margin: 8px 0;">
              Теперь вы можете войти в систему и начать работу.
            </p>
          </div>
          <p style="color: #888; font-size: 14px;">
            Если у вас возникнут вопросы, обратитесь к администратору.
          </p>
        </div>
      `;
    } else {
      subject = title || 'Новое уведомление';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${title}</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; margin: 8px 0;">
              ${message}
            </p>
          </div>
          ${task_id ? `
            <p style="color: #666; font-size: 14px;">
              <a href="${supabaseUrl.replace('.supabase.co', '')}/tasks/${task_id}" style="color: #3b82f6;">
                Перейти к задаче
              </a>
            </p>
          ` : ''}
          <p style="color: #888; font-size: 14px;">
            Это автоматическое уведомление из CRM системы.
          </p>
        </div>
      `;
    }

    const { error: emailError } = await resend.emails.send({
      from: "CRM <onboarding@resend.dev>",
      to: [profile.email],
      subject: subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent to ${profile.email}`);

    return new Response(
      JSON.stringify({ success: true, email: profile.email }),
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
