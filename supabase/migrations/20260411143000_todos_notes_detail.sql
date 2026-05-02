ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS prio text DEFAULT 'm';
