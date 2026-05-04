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
- create_subtask — добавить подзадачу к существующей задаче
- create_client — добавить нового клиента
- create_meeting — создать встречу с участниками
- update_task — изменить задачу (название, описание, статус, срок, цвет, проект)
- update_subtask — изменить подзадачу (название, отметка выполнения)
- update_project — изменить проект (название, описание, статус, бюджет, сроки)
- add_task_assignees — добавить исполнителей или наблюдателей к задаче (ищи по именам)
- add_task_tags — добавить теги к задаче (создаёт теги если их нет)
- log_time — записать время работы по задаче (минуты + опц. описание)
- create_whiteboard — создать новую доску и, если указана задача, сразу привязать её к задаче

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
      name: "create_subtask",
      description: "Добавить одну или несколько подзадач (чек-лист) к существующей задаче. Найди задачу по названию через task_query или передай task_id.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID задачи (если уже известен)" },
          task_query: { type: "string", description: "Часть названия задачи для поиска (если task_id неизвестен)" },
          titles: {
            type: "array",
            items: { type: "string" },
            description: "Список названий подзадач для добавления",
          },
        },
        required: ["titles"],
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
  {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Создать новую встречу. Дата и время обязательны. Если их нет — уточни у пользователя перед вызовом. Место/ссылку на видеозвонок (Google Meet, Zoom) добавляй в description.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Название встречи" },
          meeting_date: { type: "string", description: "Дата встречи в формате YYYY-MM-DD" },
          start_time: { type: "string", description: "Время начала в формате HH:MM (24ч)" },
          end_time: { type: "string", description: "Время окончания HH:MM (опционально, по умолчанию +1 час)" },
          description: { type: "string", description: "Описание встречи, место проведения, ссылка на Google Meet/Zoom и т.д." },
          participant_names: {
            type: "array",
            items: { type: "string" },
            description: "Имена участников (как в системе). Бэкенд найдёт пользователей по имени.",
          },
        },
        required: ["title", "meeting_date", "start_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Изменить существующую задачу. Найди по task_id или task_query (часть названия). Обновляй только переданные поля.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID задачи (если известен)" },
          task_query: { type: "string", description: "Часть названия задачи для поиска" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "review", "done"] },
          deadline: { type: "string", description: "YYYY-MM-DD или ISO; пустая строка очищает" },
          color: { type: "string", description: "HEX цвет, напр. #3b82f6" },
          project_query: { type: "string", description: "Название проекта для привязки (опционально)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_subtask",
      description: "Изменить подзадачу: переименовать или отметить выполненной/невыполненной. Ищи через subtask_query внутри указанной задачи.",
      parameters: {
        type: "object",
        properties: {
          subtask_id: { type: "string" },
          task_query: { type: "string", description: "Часть названия родительской задачи (если subtask_id неизвестен)" },
          subtask_query: { type: "string", description: "Часть названия подзадачи" },
          title: { type: "string" },
          is_completed: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Изменить существующий проект. Найди по project_id или project_query.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          project_query: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["planning", "in_progress", "on_hold", "completed", "cancelled"] },
          budget: { type: "number" },
          currency: { type: "string", description: "USD/EUR/UAH/RUB и т.д." },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_task_assignees",
      description: "Добавить пользователей в задачу как исполнителей (executor) или наблюдателей (observer). Ищи по именам.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          task_query: { type: "string" },
          user_names: { type: "array", items: { type: "string" }, description: "Имена пользователей" },
          role: { type: "string", enum: ["executor", "observer"], description: "По умолчанию executor" },
        },
        required: ["user_names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_task_tags",
      description: "Добавить теги к задаче. Если тег с таким именем не существует — создаст его.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          task_query: { type: "string" },
          tag_names: { type: "array", items: { type: "string" } },
        },
        required: ["tag_names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_time",
      description: "Записать время работы по задаче в минутах. Время фиксируется как завершённый интервал заканчивающийся сейчас.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          task_query: { type: "string" },
          minutes: { type: "number", description: "Количество минут" },
          description: { type: "string" },
        },
        required: ["minutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_whiteboard",
      description: "Создать новую доску (whiteboard). Можно сразу привязать к задаче через task_id или task_query; если у задачи есть проект, доска наследует project_id.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          task_id: { type: "string", description: "UUID задачи для привязки (если известен)" },
          task_query: { type: "string", description: "Часть названия задачи для поиска и привязки" },
          project_query: { type: "string", description: "Название проекта для привязки (опц.)" },
        },
        required: ["title"],
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

async function createSubtaskFn(supabase: any, args: any, userId: string) {
  const titles: string[] = Array.isArray(args.titles) ? args.titles.filter((t: any) => typeof t === "string" && t.trim()) : [];
  if (titles.length === 0) return { error: "Нужен хотя бы один title в titles[]" };

  let taskId: string | null = args.task_id || null;
  let taskTitle = "";

  if (!taskId && args.task_query) {
    const { data: tasks } = await supabase
      .from("tasks").select("id, title").ilike("title", `%${args.task_query}%`).limit(1);
    if (tasks && tasks.length) {
      taskId = tasks[0].id;
      taskTitle = tasks[0].title;
    }
  } else if (taskId) {
    const { data: t } = await supabase.from("tasks").select("title").eq("id", taskId).single();
    taskTitle = t?.title || "";
  }

  if (!taskId) return { error: "Задача не найдена. Передай task_id или уточни task_query." };

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("subtasks").select("sort_order").eq("task_id", taskId).order("sort_order", { ascending: false }).limit(1);
  let nextOrder = (existing && existing.length ? (existing[0].sort_order || 0) + 1 : 0);

  const rows = titles.map((title) => ({
    task_id: taskId,
    title: title.trim(),
    sort_order: nextOrder++,
    created_by: userId,
  }));

  const { data, error } = await supabase.from("subtasks").insert(rows).select("id, title");
  if (error) return { error: error.message };

  return {
    success: true,
    task: { id: taskId, title: taskTitle },
    added_count: data?.length || 0,
    subtasks: (data || []).map((s: any) => s.title),
  };
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

async function createMeetingFn(supabase: any, args: any, userId: string) {
  if (!args.title || !args.meeting_date || !args.start_time) {
    return { error: "Нужны title, meeting_date (YYYY-MM-DD) и start_time (HH:MM)" };
  }

  // Compute end_time default = start + 1h
  let endTime = args.end_time as string | undefined;
  if (!endTime) {
    const [h, m] = args.start_time.split(":").map(Number);
    const eh = Math.min(23, (h || 0) + 1);
    endTime = `${String(eh).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  }

  // Защита от дублей: если этим пользователем уже создана встреча с таким же
  // названием/датой/временем — вернём её, не создавая новую.
  const startHHMM = String(args.start_time).slice(0, 5);
  const { data: existing } = await supabase
    .from("meetings")
    .select("id, title, meeting_date, start_time, end_time")
    .eq("created_by", userId)
    .eq("meeting_date", args.meeting_date)
    .eq("title", args.title)
    .limit(5);

  const dup = (existing || []).find(
    (m: any) => String(m.start_time).slice(0, 5) === startHHMM
  );
  if (dup) {
    return {
      success: true,
      duplicate: true,
      message: "Такая встреча уже существует — повторно не создаю.",
      meeting: {
        id: dup.id,
        title: dup.title,
        date: dup.meeting_date,
        start_time: dup.start_time,
        end_time: dup.end_time,
      },
    };
  }

  const { data: meeting, error } = await supabase.from("meetings").insert({
    title: args.title,
    description: args.description || null,
    meeting_date: args.meeting_date,
    start_time: args.start_time,
    end_time: endTime,
    created_by: userId,
  }).select().single();

  if (error) return { error: error.message };

  // Resolve participants by name
  const matched: { user_id: string; name: string }[] = [];
  const notFound: string[] = [];
  const names: string[] = Array.isArray(args.participant_names) ? args.participant_names : [];

  for (const rawName of names) {
    const name = String(rawName).trim();
    if (!name) continue;
    const { data: profs } = await supabase
      .from("public_profiles")
      .select("user_id, name")
      .ilike("name", `%${name}%`)
      .limit(2);
    if (profs && profs.length > 0) {
      if (!matched.some((p) => p.user_id === profs[0].user_id)) {
        matched.push({ user_id: profs[0].user_id, name: profs[0].name });
      }
    } else {
      notFound.push(name);
    }
  }

  // Always include creator
  if (!matched.some((p) => p.user_id === userId)) {
    matched.push({ user_id: userId, name: "creator" });
  }

  if (matched.length > 0) {
    await supabase.from("meeting_participants").insert(
      matched.map((p) => ({ meeting_id: meeting.id, user_id: p.user_id }))
    );

    // Notifications for invited participants (skip creator)
    const invited = matched.filter((p) => p.user_id !== userId);
    if (invited.length > 0) {
      await supabase.from("notifications").insert(
        invited.map((p) => ({
          user_id: p.user_id,
          type: "meeting_invite",
          title: "Приглашение на встречу",
          message: `Вас пригласили на встречу "${args.title}" ${args.meeting_date} в ${args.start_time}`,
          created_by: userId,
          meeting_id: meeting.id,
        }))
      );
    }
  }

  return {
    success: true,
    meeting: {
      id: meeting.id,
      title: meeting.title,
      date: meeting.meeting_date,
      start_time: meeting.start_time,
      end_time: endTime,
    },
    participants_added: matched.filter((p) => p.user_id !== userId).map((p) => p.name),
    participants_not_found: notFound,
  };
}

// ===== New helpers: edit/manage =====

async function findTaskId(supabase: any, args: any): Promise<{ id: string; title: string; project_id?: string | null } | null> {
  if (args.task_id) {
    const { data } = await supabase.from("tasks").select("id, title, project_id").eq("id", args.task_id).maybeSingle();
    if (data) return data;
  }
  if (args.task_query) {
    const { data } = await supabase
      .from("tasks").select("id, title, project_id").ilike("title", `%${args.task_query}%`).limit(1);
    if (data && data.length) return data[0];
  }
  return null;
}

async function findProjectId(supabase: any, args: any): Promise<{ id: string; title: string } | null> {
  if (args.project_id) {
    const { data } = await supabase.from("projects").select("id, title").eq("id", args.project_id).maybeSingle();
    if (data) return data;
  }
  if (args.project_query) {
    const { data } = await supabase
      .from("projects").select("id, title").ilike("title", `%${args.project_query}%`).limit(1);
    if (data && data.length) return data[0];
  }
  return null;
}

async function updateTaskFn(supabase: any, args: any) {
  const found = await findTaskId(supabase, args);
  if (!found) return { error: "Задача не найдена. Передай task_id или уточни task_query." };

  const patch: any = {};
  if (typeof args.title === "string") patch.title = args.title;
  if (typeof args.description === "string") patch.description = args.description || null;
  if (typeof args.status === "string") patch.status = args.status;
  if (typeof args.color === "string") patch.color = args.color;
  if (typeof args.deadline === "string") patch.deadline = args.deadline ? args.deadline : null;
  if (args.project_query) {
    const proj = await findProjectId(supabase, { project_query: args.project_query });
    if (proj) patch.project_id = proj.id;
  }

  if (Object.keys(patch).length === 0) return { error: "Не передано ни одного поля для обновления." };

  const { error } = await supabase.from("tasks").update(patch).eq("id", found.id);
  if (error) return { error: error.message };
  return { success: true, task: { id: found.id, title: patch.title || found.title }, updated_fields: Object.keys(patch) };
}

async function updateSubtaskFn(supabase: any, args: any) {
  let subtaskId: string | null = args.subtask_id || null;

  if (!subtaskId) {
    if (!args.subtask_query) return { error: "Нужен subtask_id или subtask_query." };
    let taskId: string | null = null;
    if (args.task_query) {
      const t = await findTaskId(supabase, { task_query: args.task_query });
      if (t) taskId = t.id;
    }
    let q = supabase.from("subtasks").select("id, title, task_id").ilike("title", `%${args.subtask_query}%`).limit(1);
    if (taskId) q = q.eq("task_id", taskId);
    const { data } = await q;
    if (!data || !data.length) return { error: "Подзадача не найдена." };
    subtaskId = data[0].id;
  }

  const patch: any = {};
  if (typeof args.title === "string") patch.title = args.title;
  if (typeof args.is_completed === "boolean") {
    patch.is_completed = args.is_completed;
    patch.completed_at = args.is_completed ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return { error: "Нечего обновлять." };

  const { error } = await supabase.from("subtasks").update(patch).eq("id", subtaskId);
  if (error) return { error: error.message };
  return { success: true, subtask_id: subtaskId, updated_fields: Object.keys(patch) };
}

async function updateProjectFn(supabase: any, args: any) {
  const found = await findProjectId(supabase, args);
  if (!found) return { error: "Проект не найден." };

  const patch: any = {};
  if (typeof args.title === "string") patch.title = args.title;
  if (typeof args.description === "string") patch.description = args.description || null;
  if (typeof args.status === "string") patch.status = args.status;
  if (typeof args.budget === "number") patch.budget = args.budget;
  if (typeof args.currency === "string") patch.currency = args.currency;
  if (typeof args.start_date === "string") patch.start_date = args.start_date || null;
  if (typeof args.end_date === "string") patch.end_date = args.end_date || null;

  if (Object.keys(patch).length === 0) return { error: "Не передано ни одного поля для обновления." };

  const { error } = await supabase.from("projects").update(patch).eq("id", found.id);
  if (error) return { error: error.message };
  return { success: true, project: { id: found.id, title: patch.title || found.title }, updated_fields: Object.keys(patch) };
}

async function addTaskAssigneesFn(supabase: any, args: any) {
  const task = await findTaskId(supabase, args);
  if (!task) return { error: "Задача не найдена." };
  const role = args.role === "observer" ? "observer" : "executor";
  const names: string[] = Array.isArray(args.user_names) ? args.user_names : [];
  if (names.length === 0) return { error: "Нужны user_names." };

  const matched: { user_id: string; name: string }[] = [];
  const notFound: string[] = [];
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    const { data: profs } = await supabase
      .from("public_profiles").select("user_id, name").ilike("name", `%${name}%`).limit(1);
    if (profs && profs.length) matched.push({ user_id: profs[0].user_id, name: profs[0].name });
    else notFound.push(name);
  }

  if (matched.length === 0) {
    return { error: "Никто из указанных пользователей не найден.", not_found: notFound };
  }

  const rows = matched.map((m) => ({ task_id: task.id, user_id: m.user_id, role }));
  const { error } = await supabase.from("task_assignees").upsert(rows, { onConflict: "task_id,user_id,role", ignoreDuplicates: true });
  if (error) return { error: error.message };
  return {
    success: true,
    task: { id: task.id, title: task.title },
    role,
    added: matched.map((m) => m.name),
    not_found: notFound,
  };
}

async function addTaskTagsFn(supabase: any, args: any, userId: string) {
  const task = await findTaskId(supabase, args);
  if (!task) return { error: "Задача не найдена." };
  const names: string[] = Array.isArray(args.tag_names) ? args.tag_names.filter((s: any) => typeof s === "string" && s.trim()) : [];
  if (names.length === 0) return { error: "Нужны tag_names." };

  const tagIds: string[] = [];
  for (const rawName of names) {
    const name = rawName.trim();
    const { data: existing } = await supabase.from("tags").select("id").ilike("name", name).limit(1);
    if (existing && existing.length) {
      tagIds.push(existing[0].id);
      continue;
    }
    const { data: created, error: ce } = await supabase
      .from("tags").insert({ name, color: "#6366f1", created_by: userId }).select("id").single();
    if (ce) return { error: `Не удалось создать тег "${name}": ${ce.message}` };
    if (created) tagIds.push(created.id);
  }

  const rows = tagIds.map((id) => ({ task_id: task.id, tag_id: id }));
  const { error } = await supabase.from("task_tags").upsert(rows, { onConflict: "task_id,tag_id", ignoreDuplicates: true });
  if (error) return { error: error.message };
  return { success: true, task: { id: task.id, title: task.title }, added_tags: names };
}

async function logTimeFn(supabase: any, args: any, userId: string) {
  const task = await findTaskId(supabase, args);
  if (!task) return { error: "Задача не найдена." };
  const minutes = Number(args.minutes);
  if (!minutes || minutes <= 0) return { error: "minutes должен быть положительным числом." };

  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);

  const { data, error } = await supabase.from("time_entries").insert({
    task_id: task.id,
    user_id: userId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration_minutes: Math.round(minutes),
    description: args.description || null,
  }).select("id").single();
  if (error) return { error: error.message };

  return { success: true, time_entry_id: data.id, task: { id: task.id, title: task.title }, minutes: Math.round(minutes) };
}

async function createWhiteboardFn(supabase: any, args: any, userId: string) {
  if (!args.title) return { error: "Нужен title." };
  const task = (args.task_id || args.task_query) ? await findTaskId(supabase, args) : null;
  if ((args.task_id || args.task_query) && !task) {
    return { error: "Задача не найдена. Передай task_id или уточни task_query." };
  }

  let projectId: string | null = null;
  if (task?.project_id) {
    projectId = task.project_id;
  } else if (args.project_query) {
    const proj = await findProjectId(supabase, { project_query: args.project_query });
    if (proj) projectId = proj.id;
  }

  const { data, error } = await supabase.from("whiteboards").insert({
    title: args.title,
    description: args.description || null,
    project_id: projectId,
    created_by: userId,
  }).select("id, title").single();
  if (error) return { error: error.message };

  let linkedTask: { id: string; title: string } | null = null;
  if (task) {
    const { error: linkError } = await supabase.from("task_whiteboards").insert({
      task_id: task.id,
      whiteboard_id: data.id,
      created_by: userId,
    });
    if (linkError) {
      await supabase.from("whiteboards").delete().eq("id", data.id);
      return { error: `Доска создана, но не удалось привязать к задаче: ${linkError.message}` };
    }
    linkedTask = { id: task.id, title: task.title };
  }

  return { success: true, whiteboard: { id: data.id, title: data.title }, linked_task: linkedTask };
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

    const today = new Date().toISOString().slice(0, 10);
    const systemWithDate = `${SYSTEM_PROMPT}\n\nТекущая дата: ${today}. При расчёте «завтра», «послезавтра» и т.п. используй её.`;

    const callAI = async (msgs: any[]) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemWithDate }, ...msgs],
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

          // Дедуп идентичных tool_calls в одном раунде (модель иногда дублирует create_meeting и т.п.)
          const seen = new Set<string>();
          const uniqueCalls: any[] = [];
          for (const tc of toolCalls) {
            const key = `${tc.function?.name}::${tc.function?.arguments || ""}`;
            if (seen.has(key)) {
              currentMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ skipped: true, reason: "duplicate tool call in the same turn" }),
              });
              continue;
            }
            seen.add(key);
            uniqueCalls.push(tc);
          }

          for (const tc of uniqueCalls) {
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
                case "create_subtask": result = await createSubtaskFn(supabase, args, user.id); break;
                case "create_client": result = await createClientFn(supabase, args, user.id); break;
                case "create_meeting": result = await createMeetingFn(supabase, args, user.id); break;
                case "update_task": result = await updateTaskFn(supabase, args); break;
                case "update_subtask": result = await updateSubtaskFn(supabase, args); break;
                case "update_project": result = await updateProjectFn(supabase, args); break;
                case "add_task_assignees": result = await addTaskAssigneesFn(supabase, args); break;
                case "add_task_tags": result = await addTaskTagsFn(supabase, args, user.id); break;
                case "log_time": result = await logTimeFn(supabase, args, user.id); break;
                case "create_whiteboard": result = await createWhiteboardFn(supabase, args, user.id); break;
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
