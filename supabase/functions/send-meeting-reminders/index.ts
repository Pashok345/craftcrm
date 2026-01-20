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

interface MeetingWithEmails {
  meeting: any;
  emails: string[];
  userIds: string[];
}

async function sendMeetingEmails(
  supabase: any, 
  meetings: any[], 
  reminderType: '1hour' | '15min' | 'started',
  emailsSent: string[]
) {
  const reminderText = {
    '1hour': { subject: 'через 1 час', message: 'Встреча начнётся через 1 час.' },
    '15min': { subject: 'через 15 минут', message: 'Встреча начнётся через 15 минут. Не опоздайте!' },
    'started': { subject: 'началась', message: 'Встреча уже началась! Присоединяйтесь!' },
  };

  const emojiMap = {
    '1hour': '🕐',
    '15min': '⏰',
    'started': '🚀',
  };

  const colorMap = {
    '1hour': '#3b82f6',
    '15min': '#f59e0b',
    'started': '#22c55e',
  };

  for (const meeting of meetings) {
    // Get participants
    const { data: participants } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meeting.id);

    // Get creator profile
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('email, name, user_id')
      .eq('user_id', meeting.created_by)
      .single();

    // Collect all emails and user IDs
    const emailMap: Map<string, string> = new Map();
    
    if (creatorProfile?.email) {
      emailMap.set(creatorProfile.user_id, creatorProfile.email);
    }

    if (participants && participants.length > 0) {
      const userIds = participants.map((p: any) => p.user_id);
      const { data: participantProfiles } = await supabase
        .from('profiles')
        .select('email, user_id')
        .in('user_id', userIds);

      if (participantProfiles) {
        participantProfiles.forEach((p: any) => {
          if (p.email && !emailMap.has(p.user_id)) {
            emailMap.set(p.user_id, p.email);
          }
        });
      }
    }

    console.log(`Sending ${reminderType} reminders for meeting "${meeting.title}" to ${emailMap.size} recipients`);

    // Create in-app notifications for all users
    for (const [userId, email] of emailMap) {
      try {
        // Create in-app notification
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'meeting',
          title: `${emojiMap[reminderType]} Встреча ${reminderText[reminderType].subject}`,
          message: `"${meeting.title}" - ${meeting.start_time.slice(0, 5)}`,
        });

        // Send email
        const { error: emailError } = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [email],
          subject: `${emojiMap[reminderType]} ${meeting.title} - ${reminderText[reminderType].subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${colorMap[reminderType]};">${emojiMap[reminderType]} Напоминание о встрече</h2>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${colorMap[reminderType]};">
                <h3 style="color: #1a1a1a; margin-top: 0;">${meeting.title}</h3>
                <p style="color: #666; margin: 8px 0;">
                  <strong>Дата:</strong> ${meeting.meeting_date}
                </p>
                <p style="color: #666; margin: 8px 0;">
                  <strong>Время:</strong> ${meeting.start_time.slice(0, 5)}${meeting.end_time ? ` - ${meeting.end_time.slice(0, 5)}` : ''}
                </p>
                ${meeting.description ? `<p style="color: #666; margin: 8px 0;"><strong>Описание:</strong> ${meeting.description}</p>` : ''}
              </div>
              <p style="color: #888; font-size: 14px;">${reminderText[reminderType].message}</p>
              <p style="color: #888; font-size: 12px; margin-top: 20px;">
                Это автоматическое уведомление из CRM системы.
              </p>
            </div>
          `,
        });

        if (emailError) {
          console.error(`Error sending email to ${email}:`, emailError);
        } else {
          emailsSent.push(email);
          console.log(`${reminderType} reminder sent to ${email}`);
        }
      } catch (sendError) {
        console.error(`Failed to send email to ${email}:`, sendError);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization - only accept requests with service role key
    const authHeader = req.headers.get("Authorization");
    const expectedAuth = `Bearer ${supabaseServiceKey}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      console.log("Unauthorized request attempted");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Current time
    const currentHour = now.getUTCHours().toString().padStart(2, '0');
    const currentMinute = now.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    
    // 1 hour from now
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourTime = `${oneHourLater.getUTCHours().toString().padStart(2, '0')}:${oneHourLater.getUTCMinutes().toString().padStart(2, '0')}`;
    const oneHourWindowEnd = new Date(oneHourLater.getTime() + 2 * 60 * 1000);
    const oneHourWindowEndTime = `${oneHourWindowEnd.getUTCHours().toString().padStart(2, '0')}:${oneHourWindowEnd.getUTCMinutes().toString().padStart(2, '0')}`;
    
    // 15 minutes from now
    const fifteenMinLater = new Date(now.getTime() + 15 * 60 * 1000);
    const fifteenMinTime = `${fifteenMinLater.getUTCHours().toString().padStart(2, '0')}:${fifteenMinLater.getUTCMinutes().toString().padStart(2, '0')}`;
    const fifteenMinWindowEnd = new Date(fifteenMinLater.getTime() + 2 * 60 * 1000);
    const fifteenMinWindowEndTime = `${fifteenMinWindowEnd.getUTCHours().toString().padStart(2, '0')}:${fifteenMinWindowEnd.getUTCMinutes().toString().padStart(2, '0')}`;
    
    // Meetings starting now (within 2 min window)
    const startedWindowEnd = new Date(now.getTime() + 2 * 60 * 1000);
    const startedWindowEndTime = `${startedWindowEnd.getUTCHours().toString().padStart(2, '0')}:${startedWindowEnd.getUTCMinutes().toString().padStart(2, '0')}`;

    console.log(`Checking meetings at ${currentTime} on ${today}`);
    console.log(`1 hour window: ${oneHourTime} - ${oneHourWindowEndTime}`);
    console.log(`15 min window: ${fifteenMinTime} - ${fifteenMinWindowEndTime}`);
    console.log(`Started window: ${currentTime} - ${startedWindowEndTime}`);

    const emailsSent: string[] = [];

    // Get meetings starting in 1 hour
    const { data: meetingsOneHour } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', oneHourTime + ':00')
      .lte('start_time', oneHourWindowEndTime + ':00');

    if (meetingsOneHour && meetingsOneHour.length > 0) {
      console.log(`Found ${meetingsOneHour.length} meetings starting in 1 hour`);
      await sendMeetingEmails(supabase, meetingsOneHour, '1hour', emailsSent);
    }

    // Get meetings starting in 15 minutes
    const { data: meetingsFifteenMin } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', fifteenMinTime + ':00')
      .lte('start_time', fifteenMinWindowEndTime + ':00');

    if (meetingsFifteenMin && meetingsFifteenMin.length > 0) {
      console.log(`Found ${meetingsFifteenMin.length} meetings starting in 15 minutes`);
      await sendMeetingEmails(supabase, meetingsFifteenMin, '15min', emailsSent);
    }

    // Get meetings that just started
    const { data: meetingsStarted } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', currentTime + ':00')
      .lte('start_time', startedWindowEndTime + ':00');

    if (meetingsStarted && meetingsStarted.length > 0) {
      console.log(`Found ${meetingsStarted.length} meetings that just started`);
      await sendMeetingEmails(supabase, meetingsStarted, 'started', emailsSent);
    }

    const totalMeetings = (meetingsOneHour?.length || 0) + (meetingsFifteenMin?.length || 0) + (meetingsStarted?.length || 0);

    return new Response(
      JSON.stringify({ 
        message: `Processed ${totalMeetings} meetings, sent ${emailsSent.length} emails`,
        emails: emailsSent 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-meeting-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
