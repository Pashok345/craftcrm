import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ты — AI-ассистент внутри CRM-системы. Помогаешь пользователю с задачами, проектами, сделками, клиентами и встречами.

Твои возможности:
- Отвечать на вопросы о работе с CRM
- Помогать формулировать задачи, описания, тексты
- Анализировать данные проектов когда тебя об этом просят
- Использовать инструмент summarize_project, чтобы получить актуальные данные по проекту и сделать саммари

Стиль:
- Отвечай кратко и по делу
- Используй markdown для структуры (списки, заголовки, выделение)
- Отвечай на языке пользователя (украинский, русский или английский)
- Будь дружелюбным, но не многословным`;

const tools = [
  {
    type: "function",
    function: {
      name: "summarize_project",
      description:
        "Получить актуальные данные по проекту: задачи, статусы, участники, бюджет, сроки. Используй когда пользователь просит саммари/сводку/обзор проекта.",
      parameters: {
        type: "object",
        properties: {
          project_query: {
            type: "string",
            description:
              "Название проекта или его часть для поиска. Если пользователь не указал — проси уточнить.",
          },
        },
        required: ["project_query"],
      },
    },
  },
];

async function summarizeProject(supabase: any, query: string, userId: string) {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, description, status, budget, currency, start_date, end_date, manager_id, reviewer_id")
    .ilike("title", `%${query}%`)
    .limit(3);

  if (!projects || projects.length === 0) {
    return { error: `Проект по запросу "${query}" не найден` };
  }

  const project = projects[0];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, deadline")
    .eq("project_id", project.id);

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", project.id);

  const memberIds = [
    ...(members?.map((m: any) => m.user_id) || []),
    project.manager_id,
    project.reviewer_id,
  ].filter(Boolean);

  const { data: profiles } = memberIds.length
    ? await supabase
        .from("public_profiles")
        .select("user_id, name, position")
        .in("user_id", memberIds)
    : { data: [] };

  const tasksByStatus = (tasks || []).reduce((acc: any, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const overdueTasks = (tasks || []).filter(
    (t: any) => t.deadline && t.status !== "done" && new Date(t.deadline) < new Date()
  );

  return {
    project: {
      title: project.title,
      description: project.description,
      status: project.status,
      budget: project.budget,
      currency: project.currency,
      start_date: project.start_date,
      end_date: project.end_date,
    },
    manager: profiles?.find((p: any) => p.user_id === project.manager_id)?.name,
    reviewer: profiles?.find((p: any) => p.user_id === project.reviewer_id)?.name,
    members: members?.map((m: any) => ({
      name: profiles?.find((p: any) => p.user_id === m.user_id)?.name,
      role: m.role,
    })),
    tasks_total: tasks?.length || 0,
    tasks_by_status: tasksByStatus,
    overdue_tasks_count: overdueTasks.length,
    overdue_tasks: overdueTasks.slice(0, 5).map((t: any) => ({ title: t.title, deadline: t.deadline })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const callAI = async (msgs: any[]) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs],
          tools,
          stream: true,
        }),
      });

    let aiResp = await callAI(messages);

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Недостаточно кредитов AI. Пополните баланс." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream + intercept tool calls
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let currentMessages = [...messages];
        let currentResp = aiResp;

        // Loop to handle tool calls (max 3 rounds)
        for (let round = 0; round < 3; round++) {
          const reader = currentResp.body!.getReader();
          let buffer = "";
          let toolCalls: any[] = [];
          let assistantContent = "";
          let hasToolCalls = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.tool_calls) {
                  hasToolCalls = true;
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = { id: tc.id || "", type: "function", function: { name: "", arguments: "" } };
                    }
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                } else if (delta.content) {
                  assistantContent += delta.content;
                  // forward token to client
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`));
                }
              } catch {
                // partial - put back
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          if (!hasToolCalls) break;

          // Execute tool calls
          currentMessages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: toolCalls,
          });

          for (const tc of toolCalls) {
            let result: any;
            try {
              const args = JSON.parse(tc.function.arguments || "{}");
              if (tc.function.name === "summarize_project") {
                result = await summarizeProject(supabase, args.project_query, user.id);
              } else {
                result = { error: `Unknown tool: ${tc.function.name}` };
              }
            } catch (e) {
              result = { error: String(e) };
            }
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }

          // Re-call AI with tool results
          currentResp = await callAI(currentMessages);
          if (!currentResp.ok) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n\n_Ошибка при обработке инструмента._" } }] })}\n\n`));
            break;
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
