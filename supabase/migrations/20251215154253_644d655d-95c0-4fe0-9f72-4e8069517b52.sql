-- Add color column to tasks table for Gantt chart visualization
ALTER TABLE public.tasks ADD COLUMN color text DEFAULT '#3b82f6';