import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LOGO_URL = "https://iibqglmxhaiecueqbudh.supabase.co/storage/v1/object/public/avatars/email-logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const emailHeader = `
  <div style="text-align: center; margin-bottom: 32px;">
    <img src="${LOGO_URL}" alt="CRM Pro" style="max-width: 180px; height: auto;">
  </div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept both service_role key and anon JWT from pg_cron
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const expectedServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!expectedServiceKey || token !== expectedServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: inactiveDeals, error: dealsError } = await supabase
      .from('deals')
      .select('id, title, amount, updated_at, created_by, client:clients(name, email)')
      .lt('updated_at', sevenDaysAgo.toISOString())
      .order('updated_at', { ascending: true });

    if (dealsError) throw dealsError;

    console.log(`Found ${inactiveDeals?.length || 0} inactive deals`);

    if (!inactiveDeals || inactiveDeals.length === 0) {
      return new Response(
        JSON.stringify({ message: "No inactive deals found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailsSent: string[] = [];
    const notificationsSent: string[] = [];

    for (const deal of inactiveDeals) {
      const daysSinceUpdate = Math.ceil(
        (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, email, name')
        .eq('user_id', deal.created_by)
        .single();

      if (!profile) continue;

      await supabase.from('notifications').insert({
        user_id: profile.user_id,
        type: 'deal_reminder',
        title: 'Нагадування про угоду',
        message: `Угода "${deal.title}" не оновлювалась ${daysSinceUpdate} днів. Час зробити follow-up!`,
      });
      notificationsSent.push(deal.title);

      if (profile.email) {
        const clientName = (deal.client as any)?.name || 'Невідомий клієнт';
        const amount = deal.amount
          ? new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(deal.amount)
          : 'Не вказано';

        try {
          const { error: emailError } = await resend.emails.send({
            from: "CRM <onboarding@resend.dev>",
            to: [profile.email],
            subject: `🔔 Follow-up: угода "${deal.title}" потребує уваги`,
            html: `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
              <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
                  ${emailHeader}
                  <div style="background-color:white;border-radius:16px;padding:40px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                    <div style="text-align:center;margin-bottom:24px;"><span style="font-size:48px;">🔔</span></div>
                    <h1 style="color:#f59e0b;font-size:24px;margin:0 0 8px;text-align:center;">Follow-up нагадування</h1>
                    <p style="color:#6b7280;font-size:16px;margin:0 0 32px;text-align:center;">
                      Вітаємо, ${profile.name || 'колего'}! Угода потребує вашої уваги.
                    </p>
                    <div style="background:#fef3c7;border-radius:12px;padding:24px;border-left:4px solid #f59e0b;">
                      <h2 style="color:#1f2937;margin:0 0 16px;font-size:18px;">${deal.title}</h2>
                      <p style="color:#6b7280;margin:0 0 8px;font-size:14px;">👤 <strong>Клієнт:</strong> ${clientName}</p>
                      <p style="color:#6b7280;margin:0 0 8px;font-size:14px;">💰 <strong>Сума:</strong> ${amount}</p>
                      <p style="color:#6b7280;margin:0;font-size:14px;">⏳ <strong>Без активності:</strong> ${daysSinceUpdate} днів</p>
                    </div>
                    <p style="color:#6b7280;font-size:14px;margin:24px 0 0;text-align:center;">
                      Рекомендуємо зв'язатися з клієнтом для уточнення статусу угоди.
                    </p>
                  </div>
                  <div style="text-align:center;margin-top:32px;">
                    <p style="color:#9ca3af;font-size:12px;margin:0;">Це автоматичне сповіщення з CRM системи</p>
                    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0 0;">© 2025 CRM Pro. Усі права захищено.</p>
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
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${inactiveDeals.length} inactive deals`,
        notifications: notificationsSent.length,
        emails: emailsSent.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-deal-reminders:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
