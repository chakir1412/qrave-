-- Im Supabase SQL Editor ausführen (Fix 1 — RLS prüfen):
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'scan_events';
