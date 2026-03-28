import type { FounderScanEventRow } from "@/lib/founder-types";

/**
 * Pro Session nur ein Eintrag: frühestes Event im jeweiligen Zeitfenster.
 * Ohne session_id: Fallback auf `id`, sonst pro Zeile ein eigener Schlüssel (kein Zusammenlegen).
 */
export function dedupeSessionsKeepFirstEvent(rows: FounderScanEventRow[]): FounderScanEventRow[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const seen = new Set<string>();
  const out: FounderScanEventRow[] = [];
  for (const row of sorted) {
    const sid = row.session_id?.trim();
    const key =
      sid && sid.length > 0
        ? sid
        : row.id
          ? `id:${row.id}`
          : `row:${row.created_at}:${row.event_type}:${row.restaurant_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
