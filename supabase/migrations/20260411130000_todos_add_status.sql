ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS status text DEFAULT 'todo';

UPDATE public.todos SET status = 'done' WHERE done = true;
UPDATE public.todos SET status = 'todo' WHERE done = false;
