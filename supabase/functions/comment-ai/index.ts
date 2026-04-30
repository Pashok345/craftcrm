import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_MARKER = "[AI]";

type EntityType = "task" | "deal" | "proposal" | "process_run" | "project";

interface ReqBody {
  entity_type: EntityType;
  entity_id: string;
  question: string;
}

const TABLES: Record<EntityType, { comments: string; fk: string }> = {
  task: { comments: "task_comments", fk: "task_id" },
  deal: { comments: "deal_comments", fk: "deal_id" },
  proposal: { comments: "proposal_comments", fk: "proposal_id" },
  process_run: { comments: "process_run_comments", fk: "process_run_id" },
  project: { comments: "task_comments", fk: "task_id" }, // not used
};

async function loadEntityContext(supabase: any, type: EntityType, id: string): Promise<string> {
  const parts: string[] = [];

  if (type === "task") {
    const { data: task } = await supabase
      .from("tasks")
      .select("title, description, status, deadline, project_id")
      .eq("id", id)
      .maybeSingle();
    if (task) {
      parts.push(`Задача: "${task.title}"`);
      if (task.description) parts.push(`Описание: ${task.description}`);
      parts.push(`Статус: ${task.status}`);
      if (task.deadline) parts.push(`Дедлайн: ${task.deadline}`);
    }
    const { data: subtasks } = await supabase
      .from("subtasks").select("title, is_completed").eq("task_id", id).order("sort_order");
    if (subtasks?.length) {
      parts.push(`\nПодзадачи:`);
      subtasks.forEach((s: any) => parts.push(`- [${s.is_completed ? "x" : " "}] ${s.title}`));
    }
  } else if (type === "deal") {
    const { data: deal } = await supabase
      .from("deals")
      .select("title, description, amount, probability, expected_close_date, stage_id, client_id")
      .eq("id", id).maybeSingle();
    if (deal) {
      parts.push(`Сделка: "${deal.title}"`);
      if (deal.description) parts.push(`Описание: ${deal.description}`);
      if (deal.amount) parts.push(`Сумма: ${deal.amount}`);
      if (deal.probability != null) parts.push(`Вероятность: ${deal.probability}%`);
      if (deal.expected_close_date) parts.push(`Ожидаемое закрытие: ${deal.expected_close_date}`);
      if (deal.stage_id) {
        const { data: stage } = await supabase.from("deal_stages").select("name").eq("id", deal.stage_id).maybeSingle();
        if (stage?.name) parts.push(`Этап: ${stage.name}`);
      }
      if (deal.client_id) {
        const { data: client } = await supabase.from("clients").select("name, company").eq("id", deal.client_id).maybeSingle();
        if (client) parts.push(`Клиент: ${client.name}${client.company ? ` (${client.company})` : ""}`);
      }
    }
  } else if (type === "proposal") {
    const { data: p } = await supabase
      .from("proposals").select("title, status, total_amount, valid_until, content").eq("id", id).maybeSingle();
    if (p) {
      parts.push(`КП: "${p.title}"`);
      parts.push(`Статус: ${p.status}`);
      if (p.total_amount) parts.push(`Сумма: ${p.total_amount}`);
      if (p.valid_until) parts.push(`Действительно до: ${p.valid_until}`);
      if (Array.isArray(p.content) && p.content.length) {
        parts.push(`Позиции:`);
        p.content.slice(0, 20).forEach((it: any) => {
          parts.push(`- ${it.name || it.title || "—"}: ${it.qty || it.quantity || ""} x ${it.price || ""}`);
        });
      }
    }
  } else if (type === "process_run") {
    const { data: run } = await supabase
      .from("process_runs").select("status, field_values, process_id, started_at").eq("id", id).maybeSingle();
    if (run) {
      const { data: process } = await supabase.from("processes").select("title, description").eq("id", run.process_id).maybeSingle();
      parts.push(`Процесс: "${process?.title || ""}"`);
      if (process?.description) parts.push(`Описание процесса: ${process.description}`);
      parts.push(`Статус: ${run.status}`);
      if (run.field_values) parts.push(`Данные:\n${JSON.stringify(run.field_values, null, 2)}`);
    }
  }

  // Last 20 comments
  const tableInfo = TABLES[type];
  const { data: comments } = await supabase
    .from(tableInfo.comments)
    .select("user_id, content, created_at")
    .eq(tableInfo.fk, id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (comments?.length) {
    const userIds = [...new Set(comments.map((c: any) => c.user_id))];
    const { data: profs } = await supabase
      .from("profiles").select("user_id, name").in("user_id", userIds);
    const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.name]));
    parts.push(`\nИстория комментариев (последние, в обратном порядке):`);
    comments.slice().reverse().forEach((c: any) => {
      const name = nameMap.get(c.user_id) || "—";
      const isAI = c.content.startsWith(AI_MARKER);
      const text = isAI ? c.content.slice(AI_MARKER.length).trim() : c.content;
      parts.push(`[${isAI ? "AI" : name}] ${text}`);
    });
  }

  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ReqBody = await req.json();
    if (!body.entity_type || !body.entity_id || !body.question) {
      return new Response(JSON.stringify({ error: "entity_type, entity_id, question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!TABLES[body.entity_type]) {
      return new Response(JSON.stringify({ error: "Unknown entity_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = await loadEntityContext(supabase, body.entity_type, body.entity_id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Ты — AI-ассистент внутри CRM. Тебя позвали в комментариях через @AI.

Твой контекст (информация о сущности и история комментариев):
---
${context}
---

Правила:
- Отвечай на языке пользователя (украинский, русский, английский) — определи по тексту вопроса.
- Будь кратким и по делу. Используй markdown для структуры.
- Если в комментариях есть конкретный вопрос — отвечай именно на него.
- Если просят анализ/саммари — дай его с конкретными числами и фактами.
- Не повторяй контекст полностью, лишь ссылайся на нужные детали.
- Если данных недостаточно — честно скажи об этом.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.question },
        ],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит AI. Попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Закончились кредиты AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI ошибка" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const answer = aiJson.choices?.[0]?.message?.content?.trim() || "Извините, не получилось сформулировать ответ.";

    // Insert AI comment under caller's user_id with [AI] marker
    const tableInfo = TABLES[body.entity_type];
    const insertRow: any = { user_id: user.id, content: `${AI_MARKER} ${answer}` };
    insertRow[tableInfo.fk] = body.entity_id;

    const { data: inserted, error: insertErr } = await supabase
      .from(tableInfo.comments).insert(insertRow).select().single();

    if (insertErr) {
      console.error("Insert AI comment failed:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, comment: inserted, answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("comment-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
