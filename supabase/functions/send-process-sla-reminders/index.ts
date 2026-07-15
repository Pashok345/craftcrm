import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Overdue steps: in_progress or pending, sla_deadline < now, not already notified within last 4h
    const now = new Date();
    const nowIso = now.toISOString();
    const soonIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1h ahead

    const { data: steps, error } = await supabase
      .from("process_run_steps")
      .select("id, run_id, step_label, step_type, assignee_id, sla_deadline, status")
      .in("status", ["pending", "in_progress"])
      .not("sla_deadline", "is", null)
      .lte("sla_deadline", soonIso);

    if (error) throw error;
    if (!steps || steps.length === 0) {
      return new Response(JSON.stringify({ message: "No SLA reminders due", checked_at: nowIso }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let created = 0;
    for (const s of steps) {
      if (!s.assignee_id) continue;
      const isOverdue = new Date(s.sla_deadline!) < now;
      const title = isOverdue ? "SLA прострочено" : "SLA скоро настане";
      const message = `Крок "${s.step_label || s.step_type}" ${isOverdue ? "прострочено" : "має бути завершено найближчим часом"}.`;

      // Dedup: skip if similar notification exists in last 4h
      const cutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", s.assignee_id)
        .eq("type", "process_sla")
        .eq("related_id", s.id)
        .gte("created_at", cutoff)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: s.assignee_id,
        type: "process_sla",
        title,
        message,
        related_id: s.id,
        related_type: "process_run_step",
      });
      if (!nErr) created++;
    }

    return new Response(JSON.stringify({ checked: steps.length, notifications_created: created }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("SLA reminder error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
