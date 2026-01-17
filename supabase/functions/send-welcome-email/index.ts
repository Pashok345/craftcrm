import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  password: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, password }: WelcomeEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = supabaseUrl.replace('iibqglmxhaiecueqbudh.supabase.co', 'id-preview--89d1915e-0917-4526-a2dc-404fa91de9fb.lovable.app');

    const { error: emailError } = await resend.emails.send({
      from: "CRM <onboarding@resend.dev>",
      to: [email],
      subject: 'Добро пожаловать в CRM систему!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Добро пожаловать, ${name || 'пользователь'}!</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; margin: 8px 0;">
              Ваш аккаунт в CRM системе успешно создан.
            </p>
            <p style="color: #666; margin: 8px 0;">
              <strong>Email:</strong> ${email}
            </p>
            <p style="color: #666; margin: 8px 0;">
              <strong>Временный пароль:</strong> ${password}
            </p>
            <p style="color: #666; margin: 16px 0;">
              Рекомендуем сменить пароль после первого входа в систему.
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
