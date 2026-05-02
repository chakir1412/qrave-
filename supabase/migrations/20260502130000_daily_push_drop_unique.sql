-- Mehrere Tages-Specials pro Tag erlauben.
-- Bisher: UNIQUE(restaurant_id, active_date) -> nur 1 Special / Tag.
-- Neu: nur ein Index für schnelle Lookups, keine UNIQUE-Constraint mehr.

ALTER TABLE public.daily_push
  DROP CONSTRAINT IF EXISTS daily_push_restaurant_id_active_date_key;

CREATE INDEX IF NOT EXISTS daily_push_restaurant_id_active_date_idx
  ON public.daily_push (restaurant_id, active_date);
