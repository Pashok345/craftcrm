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

interface WelcomeEmailRequest {
  email: string;
  name: string;
  resetLink?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and check admin role
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

    const userId = user.id;
    
    // Verify user is admin using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!roleData) {
      console.error('User is not admin:', userId);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, name, resetLink }: WelcomeEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if we have a reset link to show a button
    const resetButtonHtml = resetLink ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Войти и установить пароль
        </a>
      </div>
    ` : `
      <p style="color: #666; margin: 16px 0;">
        Для входа в систему используйте ссылку для сброса пароля, которая была отправлена на ваш email отдельным письмом.
      </p>
    `;

    // Send welcome email with or without reset link
    const { error: emailError } = await resend.emails.send({
      from: "CRM <onboarding@resend.dev>",
      to: [email],
      subject: 'Приглашение в CRM систему',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Добро пожаловать, ${name || 'пользователь'}!</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; margin: 8px 0;">
              Вас пригласили в CRM систему.
            </p>
            <p style="color: #666; margin: 8px 0;">
              <strong>Email:</strong> ${email}
            </p>
            ${resetButtonHtml}
            <p style="color: #888; font-size: 14px; margin-top: 16px;">
              После входа вам нужно будет установить пароль и указать свою должность.
            </p>
            <p style="color: #ff6600; font-size: 14px; margin-top: 8px;">
              <strong>Важно:</strong> Ваш аккаунт станет активным после верификации администратором.
            </p>
          </div>
          <p style="color: #888; font-size: 14px;">
            Если у вас возникнут вопросы, обратитесь к администратору.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Welcome email sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});