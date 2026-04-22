import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ты — AI-ассистент внутри CRM-системы. Помогаешь пользователю с задачами, проектами, сделками, клиентами и встречами.

Твои возможности:
- Отвечать на вопросы о работе с CRM
- Получать актуальные данные через инструменты (tools)
- Создавать задачи и клиентов по запросу пользователя
- Анализировать продуктивность и сводки
- Помогать формулировать тексты и описания

Доступные инструменты:
- summarize_project — саммари проекта
- search_tasks — поиск задач (по названию, статусу, исполнителю, дедлайну)
- my_tasks_today — мои задачи на сегодня и просроченные
- sales_overview — обзор воронки продаж: суммы, прогноз, активные сделки
- search_clients — поиск клиентов и история взаимодействий
- meetings_schedule — расписание встреч с участниками
- team_analytics — продуктивность команды и сводки
- create_task — создать новую задачу
- create_client — добавить нового клиента
- create_meeting — создать встречу с участниками

Важно при создании встреч:
- Если пользователь говорит «завтра», «послезавтра», «на следующей неделе» — вычисли дату сам относительно сегодняшней (текущая дата передаётся в системе).
- Если время не указано — уточни. Если указано «утром/днём/вечером» — предложи конкретное время (например, утро=10:00, день=14:00, вечер=18:00) и подтверди.
- Участников ищи по именам через профили — передавай их имена в participant_names, бэкенд найдёт user_id.

Стиль:
- Отвечай кратко и по делу
- Используй markdown для структуры (списки, заголовки, выделение)
- Отвечай на языке пользователя (украинский, русский или английский)
- Перед созданием сущности уточни ключевые поля, если не хватает данных
- Будь дружелюбным, но не многословным`;

const tools = [
  {
    type: "function",
    function: {
      name: "summarize_project",
      description: "Получить актуальные данные по проекту: задачи, статусы, участники, бюджет, сроки.",
      parameters: {
        type: "object",
        properties: {
          project_query: { type: "string", description: "Название проекта или его часть" },
        },
        required: ["project_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tasks",
      description: "Поиск задач по названию, статусу или дедлайну. Возвращает список задач с метаданными.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Текст для поиска по названию задачи (опционально)" },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "review", "done"],
            description: "Фильтр по статусу (опционально)",
          },
          only_mine: { type: "boolean", description: "Только мои задачи (где я исполнитель)" },
          overdue: { type: "boolean", description: "Только просроченные задачи" },
          limit: { type: "number", description: "Сколько задач вернуть (по умолчанию 10, макс 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "my_tasks_today",
      description: "Мои задачи с дедлайном сегодня + все просроченные мои задачи.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "sales_overview",
      description: "Обзор воронки продаж: количество сделок по этапам, общая сумма, прогноз с учётом вероятности, активные сделки.",
      parameters: {
        type: "object",
        properties: {
          only_mine: { type: "boolean", description: "Только мои сделки" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Поиск клиентов по имени/компании. Возвращает данные клиента и историю взаимодействий.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Имя клиента или компании" },
          include_interactions: { type: "boolean", description: "Включить историю взаимодействий" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "meetings_schedule",
      description: "Расписание встреч на ближайшие дни с участниками.",
      parameters: {
        type: "object",
        properties: {
          days_ahead: { type: "number", description: "На сколько дней вперёд (по умолчанию 7)" },
          only_mine: { type: "boolean", description: "Только встречи где я участник или организатор" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "team_analytics",
      description: "Сводка продуктивности: количество задач по статусам по команде, топ исполнителей, просроченные задачи.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Период в днях для анализа (по умолчанию 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Создать новую задачу. Перед вызовом убедись что есть title.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Название задачи" },
          description: { type: "string", description: "Описание задачи" },
          deadline: { type: "string", description: "Дедлайн в формате YYYY-MM-DD или ISO" },
          status: { type: "string", enum: ["todo", "in_progress", "review", "done"] },
          project_query: { type: "string", description: "Название проекта (опционально)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Добавить нового клиента в CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Имя клиента" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          position: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
];

// ===== Tool implementations =====

async function summarizeProject(supabase: any, query: string) {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, description, status, budget, currency, start_date, end_date, manager_id, reviewer_id")
    .ilike("title", `%${query}%`)
    .limit(3);

  if (!projects || projects.length === 0) return { error: `Проект "${query}" не найден` };
  const project = projects[0];

  const { data: tasks } = await supabase
    .from("tasks").select("id, title, status, deadline").eq("project_id", project.id);

  const { data: members } = await supabase
    .from("project_members").select("user_id, role").eq("project_id", project.id);

  const memberIds = [
    ...(members?.map((m: any) => m.user_id) || []),
    project.manager_id, project.reviewer_id,
  ].filter(Boolean);

  const { data: profiles } = memberIds.length
    ? await supabase.from("public_profiles").select("user_id, name, position").in("user_id", memberIds)
    : { data: [] };

  const tasksByStatus = (tasks || []).reduce((acc: any, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1; return acc;
  }, {});

  const overdueTasks = (tasks || []).filter(
    (t: any) => t.deadline && t.status !== "done" && new Date(t.deadline) < new Date()
  );

  return {
    project: {
      title: project.title, description: project.description, status: project.status,
      budget: project.budget, currency: project.currency,
      start_date: project.start_date, end_date: project.end_date,
    },
    manager: profiles?.find((p: any) => p.user_id === project.manager_id)?.name,
    reviewer: profiles?.find((p: any) => p.user_id === project.reviewer_id)?.name,
    members: members?.map((m: any) => ({
      name: profiles?.find((p: any) => p.user_id === m.user_id)?.name, role: m.role,
    })),
    tasks_total: tasks?.length || 0,
    tasks_by_status: tasksByStatus,
    overdue_tasks_count: overdueTasks.length,
    overdue_tasks: overdueTasks.slice(0, 5).map((t: any) => ({ title: t.title, deadline: t.deadline })),
  };
}

async function searchTasks(supabase: any, args: any, userId: string) {
  const limit = Math.min(args.limit || 10, 30);
  let q = supabase.from("tasks").select("id, title, status, deadline, project_id, created_by").limit(limit);

  if (args.query) q = q.ilike("title", `%${args.query}%`);
  if (args.status) q = q.eq("status", args.status);
  if (args.overdue) q = q.lt("deadline", new Date().toISOString()).neq("status", "done");

  const { data: tasks, error } = await q.order("deadline", { ascending: true, nullsFirst: false });
  if (error) return { error: error.message };

  let filtered = tasks || [];
  if (args.only_mine) {
    const { data: assigned } = await supabase
      .from("task_assignees").select("task_id").eq("user_id", userId);
    const myTaskIds = new Set((assigned || []).map((a: any) => a.task_id));
    filtered = filtered.filter((t: any) => myTaskIds.has(t.id) || t.created_by === userId);
  }

  return {
    count: filtered.length,
    tasks: filtered.map((t: any) => ({
      title: t.title, status: t.status, deadline: t.deadline,
    })),
  };
}

async function myTasksToday(supabase: any, userId: string) {
  const { data: assigned } = await supabase
    .from("task_assignees").select("task_id").eq("user_id", userId);
  const ids = (assigned || []).map((a: any) => a.task_id);

  let myTasks: any[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("tasks").select("id, title, status, deadline").in("id", ids).neq("status", "done");
    myTasks = data || [];
  }
  const { data: created } = await supabase
    .from("tasks").select("id, title, status, deadline").eq("created_by", userId).neq("status", "done");
  const map = new Map(myTasks.map((t) => [t.id, t]));
  (created || []).forEach((t: any) => map.set(t.id, t));
  const all = Array.from(map.values());

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = all.filter((t) => t.deadline?.startsWith(todayStr));
  const overdue = all.filter((t) => t.deadline && new Date(t.deadline) < now && !t.deadline.startsWith(todayStr));

  return {
    today_count: today.length,
    today: today.map((t) => ({ title: t.title, status: t.status, deadline: t.deadline })),
    overdue_count: overdue.length,
    overdue: overdue.slice(0, 10).map((t) => ({ title: t.title, status: t.status, deadline: t.deadline })),
  };
}

async function salesOverview(supabase: any, args: any, userId: string) {
  let dq = supabase.from("deals").select("id, title, amount, probability, expected_close_date, stage_id, created_by");
  if (args.only_mine) dq = dq.eq("created_by", userId);
  const { data: deals } = await dq;

  const { data: stages } = await supabase
    .from("deal_stages").select("id, name, sort_order").order("sort_order");

  const stageMap = new Map((stages || []).map((s: any) => [s.id, s.name]));
  const byStage: Record<string, { count: number; amount: number }> = {};
  let totalAmount = 0, forecast = 0;

  (deals || []).forEach((d: any) => {
    const stageName = stageMap.get(d.stage_id) || "—";
    if (!byStage[stageName]) byStage[stageName] = { count: 0, amount: 0 };
    byStage[stageName].count += 1;
    byStage[stageName].amount += Number(d.amount || 0);
    totalAmount += Number(d.amount || 0);
    forecast += Number(d.amount || 0) * ((d.probability || 0) / 100);
  });

  const active = (deals || [])
    .sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5)
    .map((d: any) => ({
      title: d.title, amount: d.amount,
      stage: stageMap.get(d.stage_id), probability: d.probability,
      expected_close_date: d.expected_close_date,
    }));

  return {
    total_deals: deals?.length || 0,
    total_amount: totalAmount,
    forecast_weighted: Math.round(forecast),
    by_stage: byStage,
    top_active: active,
  };
}

async function searchClients(supabase: any, args: any, userId: string) {
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, company, position, notes, created_by")
    .or(`name.ilike.%${args.query}%,company.ilike.%${args.query}%`)
    .limit(5);

  if (!clients || clients.length === 0) return { error: `Клиент "${args.query}" не найден` };

  const result: any[] = [];
  for (const c of clients) {
    const item: any = {
      name: c.name, email: c.email, phone: c.phone,
      company: c.company, position: c.position, notes: c.notes,
    };
    if (args.include_interactions) {
      const { data: interactions } = await supabase
        .from("client_interactions")
        .select("type, description, created_at")
        .eq("client_id", c.id).order("created_at", { ascending: false }).limit(10);
      item.interactions = interactions || [];
    }
    result.push(item);
  }
  return { count: result.length, clients: result };
}

async function meetingsSchedule(supabase: any, args: any, userId: string) {
  const days = args.days_ahead || 7;
  const today = new Date().toISOString().split("T")[0];
  const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, description, meeting_date, start_time, end_time, created_by")
    .gte("meeting_date", today).lte("meeting_date", future)
    .order("meeting_date").order("start_time");

  let filtered = meetings || [];
  if (args.only_mine) {
    const { data: parts } = await supabase
      .from("meeting_participants").select("meeting_id").eq("user_id", userId);
    const myIds = new Set((parts || []).map((p: any) => p.meeting_id));
    filtered = filtered.filter((m: any) => myIds.has(m.id) || m.created_by === userId);
  }

  const result: any[] = [];
  for (const m of filtered.slice(0, 20)) {
    const { data: parts } = await supabase
      .from("meeting_participants").select("user_id").eq("meeting_id", m.id);
    const ids = (parts || []).map((p: any) => p.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("public_profiles").select("user_id, name").in("user_id", ids)
      : { data: [] };
    result.push({
      title: m.title, date: m.meeting_date,
      start: m.start_time, end: m.end_time,
      participants: (profs || []).map((p: any) => p.name),
    });
  }
  return { count: result.length, meetings: result };
}

async function teamAnalytics(supabase: any, args: any) {
  const days = args.days || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: tasks } = await supabase
    .from("tasks").select("id, status, deadline, created_at").gte("created_at", since);

  const byStatus: Record<string, number> = {};
  let overdue = 0;
  (tasks || []).forEach((t: any) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    if (t.deadline && t.status !== "done" && new Date(t.deadline) < new Date()) overdue++;
  });

  const { data: assignees } = await supabase
    .from("task_assignees").select("user_id, task_id");
  const taskIds = new Set((tasks || []).map((t: any) => t.id));
  const userCounts: Record<string, number> = {};
  (assignees || []).forEach((a: any) => {
    if (taskIds.has(a.task_id)) userCounts[a.user_id] = (userCounts[a.user_id] || 0) + 1;
  });
  const topIds = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: profs } = topIds.length
    ? await supabase.from("public_profiles").select("user_id, name").in("user_id", topIds.map(([id]) => id))
    : { data: [] };

  return {
    period_days: days,
    tasks_total: tasks?.length || 0,
    tasks_by_status: byStatus,
    overdue_count: overdue,
    completion_rate: tasks?.length ? Math.round(((byStatus.done || 0) / tasks.length) * 100) : 0,
    top_performers: topIds.map(([id, count]) => ({
      name: profs?.find((p: any) => p.user_id === id)?.name || "—",
      tasks_count: count,
    })),
  };
}

async function createTask(supabase: any, args: any, userId: string) {
  let projectId: string | null = null;
  if (args.project_query) {
    const { data: projects } = await supabase
      .from("projects").select("id, title").ilike("title", `%${args.project_query}%`).limit(1);
    if (projects && projects.length) projectId = projects[0].id;
  }

  const { data, error } = await supabase.from("tasks").insert({
    title: args.title,
    description: args.description || null,
    deadline: args.deadline || null,
    status: args.status || "todo",
    project_id: projectId,
    created_by: userId,
  }).select().single();

  if (error) return { error: error.message };
  return { success: true, task: { id: data.id, title: data.title, status: data.status } };
}

async function createClientFn(supabase: any, args: any, userId: string) {
  const { data, error } = await supabase.from("clients").insert({
    name: args.name,
    email: args.email || null,
    phone: args.phone || null,
    company: args.company || null,
    position: args.position || null,
    notes: args.notes || null,
    created_by: userId,
  }).select().single();

  if (error) return { error: error.message };
  return { success: true, client: { id: data.id, name: data.name } };
}

// ===== Server =====

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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const callAI = async (msgs: any[]) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs],
          tools, stream: true,
        }),
      });

    const aiResp = await callAI(messages);

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("OpenAI error:", aiResp.status, t);
      if (aiResp.status === 401) {
        return new Response(JSON.stringify({ error: "Неверный OpenAI API ключ." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит OpenAI или закончилась квота." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Ошибка OpenAI API" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let currentMessages = [...messages];
        let currentResp = aiResp;

        for (let round = 0; round < 4; round++) {
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
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`));
                }
              } catch {
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          if (!hasToolCalls) break;

          currentMessages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: toolCalls,
          });

          for (const tc of toolCalls) {
            let result: any;
            try {
              const args = JSON.parse(tc.function.arguments || "{}");
              switch (tc.function.name) {
                case "summarize_project": result = await summarizeProject(supabase, args.project_query); break;
                case "search_tasks": result = await searchTasks(supabase, args, user.id); break;
                case "my_tasks_today": result = await myTasksToday(supabase, user.id); break;
                case "sales_overview": result = await salesOverview(supabase, args, user.id); break;
                case "search_clients": result = await searchClients(supabase, args, user.id); break;
                case "meetings_schedule": result = await meetingsSchedule(supabase, args, user.id); break;
                case "team_analytics": result = await teamAnalytics(supabase, args); break;
                case "create_task": result = await createTask(supabase, args, user.id); break;
                case "create_client": result = await createClientFn(supabase, args, user.id); break;
                default: result = { error: `Unknown tool: ${tc.function.name}` };
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

          currentResp = await callAI(currentMessages);
          if (!currentResp.ok) {
            const errText = await currentResp.text().catch(() => "");
            console.error("OpenAI follow-up error:", currentResp.status, errText);
            let userMsg = "\n\n_Ошибка при обработке инструмента._";
            if (currentResp.status === 429) {
              userMsg = "\n\n_Превышен лимит запросов OpenAI или закончилась квота. Проверьте баланс на platform.openai.com._";
            } else if (currentResp.status === 401) {
              userMsg = "\n\n_Неверный OpenAI API ключ._";
            } else if (currentResp.status >= 500) {
              userMsg = "\n\n_OpenAI временно недоступен, попробуйте ещё раз._";
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: userMsg } }] })}\n\n`));
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
