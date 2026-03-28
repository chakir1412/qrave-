-- Im Supabase SQL Editor ausführen (Spalten von scan_events):
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scan_events'
ORDER BY ordinal_position;
