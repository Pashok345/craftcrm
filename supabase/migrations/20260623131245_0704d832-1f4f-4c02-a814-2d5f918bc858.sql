ALTER TABLE public.task_content_blocks DROP CONSTRAINT IF EXISTS task_content_blocks_type_check;
ALTER TABLE public.task_content_blocks ADD CONSTRAINT task_content_blocks_type_check
  CHECK (type IN ('empty','text','image','video','divider','file','form','heading'));