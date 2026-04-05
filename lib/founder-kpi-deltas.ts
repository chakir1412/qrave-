import {
  berlinDayElapsedFraction,
  berlinMinusCalendarDays,
  berlinYmd,
  iterateBerlinDaysInclusive,
  prevBerlinYmd,
  startOfBerlinTodayUtcIso,
} from "@/lib/berlin-time";
import type { FounderKpiDeltaLine, FounderKpiDeltas } from "@/lib/founder-types";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import type { SupabaseClient } from "@supabase/supabase-js";

const HIDDEN: FounderKpiDeltaLine = { show: false, text: "", tone: "muted" };

function emptyKpiDeltas(): FounderKpiDeltas {
  return { scansToday: HIDDEN, scansWeek: HIDDEN, consent: HIDDEN };
}

function fmtPctSigned(n: number): string {
  const r = Math.round(Math.abs(n));
  return n >= 0 ? `+${r}%` : `-${r}%`;
}

function fmtPpSigned(n: number): string {
  const r = Math.round(Math.abs(n));
  return n >= 0 ? `+${r} PP` : `-${r} PP`;
}

type DailyAggRow = {
  day_berlin: string;
  scan_count: number | null;
  sessions_count: number | null;
  sessions_with_consent: number | null;
};

function rollupDays(
  byDay: Map<string, { scans: number; sessions: number; withConsent: number }>,
  ymds: string[],
): { scans: number; sessions: number; withConsent: number } {
  let scans = 0;
  let sessions = 0;
  let withConsent = 0;
  for (const d of ymds) {
    const x = byDay.get(d);
    if (!x) continue;
    scans += x.scans;
    sessions += x.sessions;
    withConsent += x.withConsent;
  }
  return { scans, sessions, withConsent };
}

function consentRatePct(sessions: number, withConsent: number): number {
  if (sessions <= 0) return 0;
  return Math.round((withConsent / sessions) * 100);
}

/**
 * Lädt KPI-Deltas aus `restaurant_analytics_daily` (+ heute Scan-Count aus `scan_events`).
 * Ohne Service Role oder bei Fehlern: alle Deltas ausgeblendet.
 */
export async function loadFounderKpiDeltas(now: Date = new Date()): Promise<FounderKpiDeltas> {
  let supabase: SupabaseClient;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return emptyKpiDeltas();
  }

  const todayYmd = berlinYmd(now);
  const yesterdayYmd = prevBerlinYmd(todayYmd);
  const thisWeekStart = berlinMinusCalendarDays(todayYmd, 6);
  const prevWeekEnd = prevBerlinYmd(thisWeekStart);
  const prevWeekStart = berlinMinusCalendarDays(prevWeekEnd, 6);

  const thisWeekDays = iterateBerlinDaysInclusive(thisWeekStart, todayYmd);
  const prevWeekDays = iterateBerlinDaysInclusive(prevWeekStart, prevWeekEnd);

  const rangeFrom = prevWeekStart;
  const rangeTo = todayYmd;

  try {
    const [{ count: todayScanCount, error: cErr }, { data: dailyRows, error: dErr }] = await Promise.all([
      supabase
        .from("scan_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "scan")
        .gte("created_at", startOfBerlinTodayUtcIso(now)),
      supabase
        .from("restaurant_analytics_daily")
        .select("day_berlin,scan_count,sessions_count,sessions_with_consent")
        .gte("day_berlin", rangeFrom)
        .lte("day_berlin", rangeTo),
    ]);

    if (cErr || dErr) {
      return emptyKpiDeltas();
    }

    const byDay = new Map<string, { scans: number; sessions: number; withConsent: number }>();
    for (const raw of (dailyRows ?? []) as DailyAggRow[]) {
      const d = String(raw.day_berlin).slice(0, 10);
      const cur = byDay.get(d) ?? { scans: 0, sessions: 0, withConsent: 0 };
      byDay.set(d, {
        scans: cur.scans + Number(raw.scan_count ?? 0),
        sessions: cur.sessions + Number(raw.sessions_count ?? 0),
        withConsent: cur.withConsent + Number(raw.sessions_with_consent ?? 0),
      });
    }

    const yesterdayScans = byDay.get(yesterdayYmd)?.scans ?? 0;
    const frac = berlinDayElapsedFraction(now);
    const baseline = yesterdayScans * frac;
    const todayScans = todayScanCount ?? 0;

    let scansToday: FounderKpiDeltaLine = HIDDEN;
    if (baseline > 0) {
      const deltaPct = ((todayScans - baseline) / baseline) * 100;
      const tone: FounderKpiDeltaLine["tone"] =
        deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat";
      scansToday = {
        show: true,
        text: `${tone === "up" ? "↑" : tone === "down" ? "↓" : "→"} ${fmtPctSigned(deltaPct)} vs. gestern`,
        tone,
      };
    }

    const curW = rollupDays(byDay, thisWeekDays);
    const prevW = rollupDays(byDay, prevWeekDays);

    let scansWeek: FounderKpiDeltaLine = HIDDEN;
    if (prevW.scans > 0) {
      const deltaPct = ((curW.scans - prevW.scans) / prevW.scans) * 100;
      const tone: FounderKpiDeltaLine["tone"] =
        deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat";
      scansWeek = {
        show: true,
        text: `${tone === "up" ? "↑" : tone === "down" ? "↓" : "→"} ${fmtPctSigned(deltaPct)} vs. letzte Woche`,
        tone,
      };
    }

    let consent: FounderKpiDeltaLine = HIDDEN;
    if (prevW.sessions > 0) {
      const curRate = consentRatePct(curW.sessions, curW.withConsent);
      const prevRate = consentRatePct(prevW.sessions, prevW.withConsent);
      const dpp = curRate - prevRate;
      const tone: FounderKpiDeltaLine["tone"] = dpp > 0 ? "up" : dpp < 0 ? "down" : "flat";
      consent = {
        show: true,
        text: `${tone === "up" ? "↑" : tone === "down" ? "↓" : "→"} ${fmtPpSigned(dpp)} vs. letzte Woche`,
        tone,
      };
    }

    return { scansToday, scansWeek, consent };
  } catch {
    return emptyKpiDeltas();
  }
}
