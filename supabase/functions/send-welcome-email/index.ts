import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const LOGO_URL = "https://iibqglmxhaiecueqbudh.supabase.co/storage/v1/object/public/avatars/email-logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const emailHeader = `
  <div style="text-align: center; margin-bottom: 32px;">
    <img src="${LOGO_URL}" alt="CRM Pro" style="max-width: 180px; height: auto;">
  </div>`;

interface WelcomeEmailRequest {
  email: string;
  name: string;
  resetLink?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Verify JWT signature via Supabase SDK instead of manual decode
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!roleData) {
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

    const safeName = escapeHtml(name || '');
    const safeEmail = escapeHtml(email);

    const resetButtonHtml = resetLink ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(resetLink)}" 
           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
          Увійти та встановити пароль
        </a>
      </div>
    ` : `
      <p style="color: #6b7280; margin: 16px 0; text-align: center;">
        Для входу в систему використайте посилання для скидання пароля, яке було надіслано на вашу пошту окремим листом.
      </p>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "CRM <onboarding@resend.dev>",
      to: [email],
      subject: '🚀 Запрошення до CRM системи',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            ${emailHeader}
            <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <h1 style="color: #111827; font-size: 24px; margin: 0 0 8px 0; text-align: center;">
                Вітаємо, ${safeName || 'колего'}! 👋
              </h1>
              <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">
                Вас запрошено до CRM системи
              </p>
              <div style="background-color: #f0f9ff; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <span style="font-size: 20px; margin-right: 10px;">📧</span>
                  <div>
                    <p style="color: #6b7280; margin: 0; font-size: 14px;">Ваша пошта</p>
                    <p style="color: #111827; margin: 0; font-weight: 600;">${safeEmail}</p>
                  </div>
                </div>
              </div>
              ${resetButtonHtml}
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="color: #374151; font-size: 14px; font-weight: 600; margin-bottom: 16px;">Після входу вам потрібно:</p>
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                  <span style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">1</span>
                  <p style="color: #6b7280; margin: 0; font-size: 14px;">Встановити пароль для входу</p>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                  <span style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">2</span>
                  <p style="color: #6b7280; margin: 0; font-size: 14px;">Вказати номер телефону</p>
                </div>
                <div style="display: flex; align-items: flex-start;">
                  <span style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">3</span>
                  <p style="color: #6b7280; margin: 0; font-size: 14px;">Обрати вашу посаду</p>
                </div>
              </div>
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 16px; margin-top: 24px; display: flex; align-items: flex-start;">
                <span style="font-size: 20px; margin-right: 12px;">⚡</span>
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>Важливо:</strong> Ваш акаунт стане активним після верифікації адміністратором.
                </p>
              </div>
            </div>
            <div style="text-align: center; margin-top: 32px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Якщо у вас виникнуть питання, зверніться до адміністратора</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">© 2025 CRM Pro. Усі права захищено.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.warn('Email sending skipped (Resend):', emailError);
      return new Response(
        JSON.stringify({ success: true, email, email_sent: false, warning: 'Email delivery restricted by Resend domain settings' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Welcome email sent to ${email}`);
    return new Response(
      JSON.stringify({ success: true, email, email_sent: true }),
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
