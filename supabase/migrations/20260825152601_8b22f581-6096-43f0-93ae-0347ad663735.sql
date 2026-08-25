create or replace function public.task_comment_stats()
returns table(task_id uuid, comment_count bigint, last_comment_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select tc.task_id, count(*)::bigint as comment_count, max(tc.created_at) as last_comment_at
  from public.task_comments tc
  group by tc.task_id
$$;

grant execute on function public.task_comment_stats() to authenticated;

create or replace function public.wiki_category_counts()
returns table(category_id uuid, article_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select wa.category_id, count(*)::bigint as article_count
  from public.wiki_articles wa
  group by wa.category_id
$$;

grant execute on function public.wiki_category_counts() to authenticated;

create or replace function public.project_attachment_counts()
returns table(project_id uuid, attachment_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select pa.project_id, count(*)::bigint as attachment_count
  from public.project_attachments pa
  group by pa.project_id
$$;

grant execute on function public.project_attachment_counts() to authenticated;