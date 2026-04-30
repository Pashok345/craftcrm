-- 1) Удаляем дубли встреч (оставляем самую раннюю по created_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY created_by, title, meeting_date, start_time
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.meetings
)
DELETE FROM public.meetings m
USING ranked r
WHERE m.id = r.id AND r.rn > 1;

-- 2) Запрещаем создавать абсолютные дубли в будущем
CREATE UNIQUE INDEX IF NOT EXISTS meetings_unique_per_user_slot
  ON public.meetings (created_by, title, meeting_date, start_time);
