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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time and time 15 minutes from now
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Calculate current time in HH:MM format
    const currentHour = now.getUTCHours().toString().padStart(2, '0');
    const currentMinute = now.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    
    // Calculate time 15 minutes from now
    const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);
    const reminderHour = reminderTime.getUTCHours().toString().padStart(2, '0');
    const reminderMinute = reminderTime.getUTCMinutes().toString().padStart(2, '0');
    const targetTime = `${reminderHour}:${reminderMinute}`;

    console.log(`Checking meetings at ${currentTime} for reminders at ${targetTime} on ${today}`);

    // Get meetings that start in approximately 15 minutes (within a 2-minute window)
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_date', today)
      .gte('start_time', targetTime + ':00')
      .lte('start_time', `${reminderHour}:${(parseInt(reminderMinute) + 2).toString().padStart(2, '0')}:00`);

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      throw meetingsError;
    }

    console.log(`Found ${meetings?.length || 0} meetings to remind about`);

    if (!meetings || meetings.length === 0) {
      return new Response(JSON.stringify({ message: "No meetings to remind about" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailsSent: string[] = [];

    for (const meeting of meetings) {
      // Get participants
      const { data: participants } = await supabase
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', meeting.id);

      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', meeting.created_by)
        .single();

      // Collect all emails (creator + participants)
      const emails: string[] = [];
      
      if (creatorProfile?.email) {
        emails.push(creatorProfile.email);
      }

      if (participants && participants.length > 0) {
        const userIds = participants.map(p => p.user_id);
        const { data: participantProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('user_id', userIds);

        if (participantProfiles) {
          participantProfiles.forEach(p => {
            if (p.email && !emails.includes(p.email)) {
              emails.push(p.email);
            }
          });
        }
      }

      console.log(`Sending reminders for meeting "${meeting.title}" to ${emails.length} recipients`);

      // Send email to each participant
      for (const email of emails) {
        try {
          const { error: emailError } = await resend.emails.send({
            from: "CRM <onboarding@resend.dev>",
            to: [email],
            subject: `Напоминание: ${meeting.title} через 15 минут`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Напоминание о встрече</h2>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1a1a1a; margin-top: 0;">${meeting.title}</h3>
                  <p style="color: #666; margin: 8px 0;">
                    <strong>Дата:</strong> ${meeting.meeting_date}
                  </p>
                  <p style="color: #666; margin: 8px 0;">
                    <strong>Время:</strong> ${meeting.start_time.slice(0, 5)}${meeting.end_time ? ` - ${meeting.end_time.slice(0, 5)}` : ''}
                  </p>
                  ${meeting.description ? `<p style="color: #666; margin: 8px 0;"><strong>Описание:</strong> ${meeting.description}</p>` : ''}
                </div>
                <p style="color: #888; font-size: 14px;">Встреча начнётся через 15 минут. Не опоздайте!</p>
              </div>
            `,
          });

          if (emailError) {
            console.error(`Error sending email to ${email}:`, emailError);
          } else {
            emailsSent.push(email);
            console.log(`Reminder sent to ${email}`);
          }
        } catch (sendError) {
          console.error(`Failed to send email to ${email}:`, sendError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Sent ${emailsSent.length} reminder emails`,
        emails: emailsSent 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-meeting-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
