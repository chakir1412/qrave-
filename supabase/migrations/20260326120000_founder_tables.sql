CREATE TABLE IF NOT EXISTS founder_pipeline (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  area text,
  phone text,
  contact text,
  stage text DEFAULT 'contact',
  heat text DEFAULT 'warm',
  note text,
  added_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS founder_todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  sub text,
  prio text DEFAULT 'm',
  done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS founder_restaurants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  next_visit text,
  last_visit text,
  note text,
  sticker_tier text,
  sticker_paid boolean DEFAULT false,
  sticker_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE founder_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder only pipeline"
ON founder_pipeline FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY "Founder only todos"
ON founder_todos FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY "Founder only restaurants ext"
ON founder_restaurants FOR ALL
USING (true) WITH CHECK (true);
