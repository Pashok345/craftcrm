import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": supabaseUrl,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendMeetingEmails(
  supabase: any, 
  meetings: any[], 
  reminderType: '1day' | '1hour' | '15min' | 'started',
  emailsSent: string[]
) {
  const reminderText = {
    '1day': { subject: 'завтра', message: 'Зустріч відбудеться завтра. Підготуйтесь!' },
    '1hour': { subject: 'через 1 годину', message: 'Зустріч розпочнеться через 1 годину.' },
    '15min': { subject: 'через 15 хвилин', message: 'Зустріч розпочнеться через 15 хвилин. Не запізнюйтесь!' },
    'started': { subject: 'розпочалась', message: 'Зустріч вже розпочалась! Приєднуйтесь!' },
  };

  const emojiMap = { '1day': '📅', '1hour': '🕐', '15min': '⏰', 'started': '🚀' };
  const colorMap = { '1day': '#8b5cf6', '1hour': '#3b82f6', '15min': '#f59e0b', 'started': '#22c55e' };

  for (const meeting of meetings) {
    const { data: participants } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meeting.id);

    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('email, name, user_id')
      .eq('user_id', meeting.created_by)
      .single();

    const emailMap: Map<string, { email: string; name: string }> = new Map();
    
    if (creatorProfile?.email) {
      emailMap.set(creatorProfile.user_id, { email: creatorProfile.email, name: creatorProfile.name });
    }

    if (participants && participants.length > 0) {
      const userIds = participants.map((p: any) => p.user_id);
      const { data: participantProfiles } = await supabase
        .from('profiles')
        .select('email, user_id, name')
        .in('user_id', userIds);

      if (participantProfiles) {
        participantProfiles.forEach((p: any) => {
          if (p.email && !emailMap.has(p.user_id)) {
            emailMap.set(p.user_id, { email: p.email, name: p.name });
          }
        });
      }
    }

    console.log(`Sending ${reminderType} reminders for meeting "${meeting.title}" to ${emailMap.size} recipients`);

    for (const [userId, userData] of emailMap) {
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'meeting',
          title: `${emojiMap[reminderType]} Зустріч ${reminderText[reminderType].subject}`,
          message: `"${meeting.title}" - ${meeting.start_time.slice(0, 5)}`,
          meeting_id: meeting.id,
        });

        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [userData.email],
          subject: `${emojiMap[reminderType]} ${meeting.title} - ${reminderText[reminderType].subject}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 16px 24px; border-radius: 16px;">
                    <span style="color: white; font-size: 28px; font-weight: bold;">CRM Pro</span>
                  </div>
                </div>
                <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">${emojiMap[reminderType]}</span></div>
                  <h1 style="color: ${colorMap[reminderType]}; font-size: 24px; margin: 0 0 8px 0; text-align: center;">Нагадування про зустріч</h1>
                  <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">Вітаємо, ${userData.name || 'колего'}!</p>
                  <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 24px; border-left: 4px solid ${colorMap[reminderType]};">
                    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">${meeting.title}</h2>
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">📅 <strong>Дата:</strong> ${meeting.meeting_date}</p>
                    <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">🕐 <strong>Час:</strong> ${meeting.start_time.slice(0, 5)}${meeting.end_time ? ` - ${meeting.end_time.slice(0, 5)}` : ''}</p>
                    ${meeting.description ? `<p style="color: #6b7280; margin: 12px 0 0 0; font-size: 14px;">📝 <strong>Опис:</strong> ${meeting.description}</p>` : ''}
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center; font-weight: 500;">${reminderText[reminderType].message}</p>
                </div>
                <div style="text-align: center; margin-top: 32px;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">Це автоматичне сповіщення з CRM системи</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });

        if (emailError) {
          console.error(`Error sending email to ${userData.email}:`, emailError);
        } else {
          emailsSent.push(userData.email);
        }
      } catch (sendError) {
        console.error(`Failed to send to ${userData.email}:`, sendError);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    // Accept both service role key and anon key for cron compatibility
    if (!authHeader || (authHeader !== `Bearer ${supabaseServiceKey}` && authHeader !== `Bearer ${anonKey}`)) {
      console.log("Unauthorized request attempted");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const currentTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    
    const timeWindow = (base: Date) => {
      const end = new Date(base.getTime() + 5 * 60 * 1000);
      return {
        start: `${pad(base.getUTCHours())}:${pad(base.getUTCMinutes())}:00`,
        end: `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:00`,
      };
    };

    console.log(`Checking meetings at ${currentTime} on ${today}`);
    const emailsSent: string[] = [];

    // 1-day reminder: meetings tomorrow at any time (run once per day check)
    // Only send if current time is between 09:00 and 09:05 UTC
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    if (hour === 9 && minute < 5) {
      const { data: meetingsTomorrow } = await supabase
        .from('meetings')
        .select('*')
        .eq('meeting_date', tomorrow);

      if (meetingsTomorrow && meetingsTomorrow.length > 0) {
        console.log(`Found ${meetingsTomorrow.length} meetings tomorrow`);
        await sendMeetingEmails(supabase, meetingsTomorrow, '1day', emailsSent);
      }
    }

    // 1-hour reminder
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const w1h = timeWindow(oneHour);
    const { data: meetingsOneHour } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', w1h.start)
      .lte('start_time', w1h.end);

    if (meetingsOneHour && meetingsOneHour.length > 0) {
      console.log(`Found ${meetingsOneHour.length} meetings starting in 1 hour`);
      await sendMeetingEmails(supabase, meetingsOneHour, '1hour', emailsSent);
    }

    // 15-minute reminder
    const fifteenMin = new Date(now.getTime() + 15 * 60 * 1000);
    const w15 = timeWindow(fifteenMin);
    const { data: meetingsFifteenMin } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', w15.start)
      .lte('start_time', w15.end);

    if (meetingsFifteenMin && meetingsFifteenMin.length > 0) {
      console.log(`Found ${meetingsFifteenMin.length} meetings starting in 15 minutes`);
      await sendMeetingEmails(supabase, meetingsFifteenMin, '15min', emailsSent);
    }

    // Started reminder
    const wNow = timeWindow(now);
    const { data: meetingsStarted } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', wNow.start)
      .lte('start_time', wNow.end);

    if (meetingsStarted && meetingsStarted.length > 0) {
      console.log(`Found ${meetingsStarted.length} meetings that just started`);
      await sendMeetingEmails(supabase, meetingsStarted, 'started', emailsSent);
    }

    const totalMeetings = (meetingsOneHour?.length || 0) + (meetingsFifteenMin?.length || 0) + (meetingsStarted?.length || 0);

    return new Response(
      JSON.stringify({ message: `Processed ${totalMeetings} meetings, sent ${emailsSent.length} emails`, emails: emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-meeting-reminders:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
