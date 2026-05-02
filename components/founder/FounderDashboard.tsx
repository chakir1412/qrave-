"use client";

import { DM_Sans } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import {
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  Store,
  Timer,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { supabase } from "@/lib/supabase";
import type { FounderDashboardData, FounderKpiDeltaLine, FounderScanEventRow } from "@/lib/founder-types";
import { RestaurantsTab } from "@/components/founder/tabs/RestaurantsTab";
import { TodoTab } from "@/components/founder/tabs/TodoTab";
import { KontakteTab } from "@/components/founder/tabs/KontakteTab";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  ArcElement,
  Legend,
);

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const C = {
  teal: "#00c8a0",
  orange: "#ff5c1a",
  blue: "#5b9bff",
  yellow: "#ffd426",
  green: "#34e89e",
  red: "#ff4b6e",
} as const;

type Props = {
  data: FounderDashboardData;
  initialLoadError?: string | null;
};

type MainTab = "overview" | "analytics" | "restaurants" | "todo" | "kontakte";
type AnalyticsSubTab = "overview" | "restaurant" | "abtests" | "partners";

type DailyAnalyticsRow = {
  restaurant_id: string | null;
  day_berlin: string;
  scan_count: number | null;
  sessions_count: number | null;
  sessions_with_consent: number | null;
};

type PreviewTodo = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
  fallback?: boolean;
};

type PreviewPipeline = {
  id: string;
  name: string;
  stage: string | null;
  waerme: string | null;
  next_action: string | null;
  created_at: string;
};

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateLabel(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function renderNoiseDataUri(): string {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='1'/></svg>";
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function sameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}

function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function sumSafe(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
}

function topByCount(entries: Map<string, number>, limit: number): Array<{ key: string; count: number }> {
  return [...entries.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function activeHour(scanEvents: FounderScanEventRow[]): string {
  const byHour = new Map<number, number>();
  for (const e of scanEvents) {
    if (typeof e.stunde !== "number") continue;
    byHour.set(e.stunde, (byHour.get(e.stunde) ?? 0) + 1);
  }
  let bestHour = 0;
  let bestCount = 0;
  for (const [h, c] of byHour.entries()) {
    if (c > bestCount) {
      bestHour = h;
      bestCount = c;
    }
  }
  return `${String(bestHour).padStart(2, "0")}:00`;
}

function trendColor(delta: FounderKpiDeltaLine | undefined): string {
  if (!delta?.show) return "rgba(255,255,255,0.62)";
  if (delta.tone === "up") return C.green;
  if (delta.tone === "down") return C.red;
  return "rgba(255,255,255,0.62)";
}

export function FounderDashboard({ data: initialData, initialLoadError = null }: Props) {
  const [data, setData] = useState<FounderDashboardData>(initialData);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [analyticsSubTab, setAnalyticsSubTab] = useState<AnalyticsSubTab>("overview");
  const [dailyRows, setDailyRows] = useState<DailyAnalyticsRow[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<Date>(startOfDay(new Date()));
  const [rangeFrom, setRangeFrom] = useState<Date>(addDays(startOfDay(new Date()), -29));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rangeStartDraft, setRangeStartDraft] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState<Date>(() => {
    const t = startOfDay(new Date());
    return new Date(t.getFullYear(), t.getMonth() - 1, 1);
  });
  const [rangeScanSeries, setRangeScanSeries] = useState<number[]>([]);
  const [previewTodos, setPreviewTodos] = useState<PreviewTodo[]>([]);
  const [previewPipeline, setPreviewPipeline] = useState<PreviewPipeline[]>([]);
  const [pipelineTableMissing, setPipelineTableMissing] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");

  const scansToday = data.scanEventsToday.length;
  const scansWeek = data.scanEventsWeek.length;
  const consentLikeWeek = data.scanEventsWeek.filter((e) => (e.event_type ?? "").toLowerCase().includes("consent"));
  const consentAcceptedWeek = consentLikeWeek.filter((e) => {
    const t = (e.event_type ?? "").toLowerCase();
    return t.includes("accept") || t.includes("granted") || t.includes("allow");
  }).length;
  const consentRateWeek = consentLikeWeek.length > 0 ? (consentAcceptedWeek / consentLikeWeek.length) * 100 : 0;

  const activeRestaurants = useMemo(
    () => data.restaurants.filter((r) => Boolean(r.aktiv)),
    [data.restaurants],
  );

  useEffect(() => {
    if (!selectedRestaurantId && activeRestaurants.length > 0) {
      setSelectedRestaurantId(activeRestaurants[0].id);
    }
  }, [activeRestaurants, selectedRestaurantId]);

  async function loadDailyAnalytics(): Promise<void> {
    const d30 = new Date();
    d30.setDate(d30.getDate() - 29);
    const from = ymd(d30);
    const { data: rows, error } = await supabase
      .from("restaurant_analytics_daily")
      .select("restaurant_id,day_berlin,scan_count,sessions_count,sessions_with_consent")
      .gte("day_berlin", from)
      .order("day_berlin", { ascending: true });
    if (error) {
      setLoadError((prev) => prev ?? `analytics_daily: ${error.message}`);
      setDailyRows([]);
      return;
    }
    setDailyRows((rows ?? []) as DailyAnalyticsRow[]);
  }

  useEffect(() => {
    void loadDailyAnalytics();
  }, []);

  useEffect(() => {
    async function loadRangeScans(): Promise<void> {
      const fromIso = startOfDay(rangeFrom).toISOString();
      const toExcl = addDays(startOfDay(rangeTo), 1).toISOString();
      const { data: rows, error } = await supabase
        .from("scan_events")
        .select("created_at,event_type")
        .eq("event_type", "scan")
        .gte("created_at", fromIso)
        .lt("created_at", toExcl);
      if (error) {
        setRangeScanSeries([]);
        return;
      }
      const keys: string[] = [];
      for (let d = startOfDay(rangeFrom); d <= startOfDay(rangeTo); d = addDays(d, 1)) {
        keys.push(ymd(d));
      }
      const byDay = new Map<string, number>();
      for (const row of rows ?? []) {
        const rec = row as { created_at: string };
        const k = ymd(new Date(rec.created_at));
        byDay.set(k, (byDay.get(k) ?? 0) + 1);
      }
      setRangeScanSeries(keys.map((k) => byDay.get(k) ?? 0));
    }
    void loadRangeScans();
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    async function loadPreviewData(): Promise<void> {
      const { data: todoRows, error: todoErr } = await supabase
        .from("todos")
        .select("*")
        .eq("status", "todo")
        .order("created_at", { ascending: false })
        .limit(5);
      if (todoErr) {
        setPreviewTodos([]);
      } else if (!todoRows || todoRows.length === 0) {
        const fallbacks = [
          {
            text: "Mobile Test auf iPhone durchführen",
            priority: "high",
            status: "todo",
            done: false,
          },
          {
            text: "QR Export Fix (Pop-up geblockt)",
            priority: "high",
            status: "todo",
            done: false,
          },
          {
            text: "Ersten Werbepartner ansprechen",
            priority: "medium",
            status: "todo",
            done: false,
          },
          {
            text: "Vercel-GitHub Webhook prüfen",
            priority: "low",
            status: "todo",
            done: false,
          },
        ];
        const { data: inserted } = await supabase
          .from("todos")
          .insert(fallbacks)
          .select("id,text,done,created_at");
        setPreviewTodos((inserted ?? []) as PreviewTodo[]);
      } else {
        setPreviewTodos((todoRows as PreviewTodo[]).slice(0, 5));
      }

      const { data: pRows, error: pErr } = await supabase
        .from("pipeline")
        .select("id,name,stage,waerme,next_action,created_at")
        .order("created_at", { ascending: false })
        .limit(4);
      if (pErr) {
        setPreviewPipeline([]);
        setPipelineTableMissing(pErr.message.toLowerCase().includes("does not exist"));
      } else {
        setPipelineTableMissing(false);
        setPreviewPipeline((pRows ?? []) as PreviewPipeline[]);
      }
    }
    void loadPreviewData();
  }, []);

  async function refreshAll(): Promise<void> {
    setRefreshing(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/founder/refresh", { credentials: "same-origin" });
      if (!res.ok) {
        setLoadError("Daten konnten nicht aktualisiert werden.");
        return;
      }
      const payload = (await res.json()) as FounderDashboardData;
      setData(payload);
      await loadDailyAnalytics();
    } catch {
      setLoadError("Netzwerkfehler beim Aktualisieren.");
    } finally {
      setRefreshing(false);
    }
  }

  const noiseUrl = renderNoiseDataUri();

  const analyticsOverview = useMemo(() => {
    const d30 = new Date();
    const d7 = new Date();
    d30.setDate(d30.getDate() - 29);
    d7.setDate(d7.getDate() - 6);

    const labels: string[] = [];
    const keys: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(d30);
      d.setDate(d30.getDate() + i);
      const key = ymd(d);
      keys.push(key);
      labels.push(dateLabel(d.toISOString()));
    }

    const byDate = new Map<string, number>();
    let accepted30 = 0;
    let declined30 = 0;
    for (const row of dailyRows) {
      const key = row.day_berlin;
      byDate.set(key, (byDate.get(key) ?? 0) + (row.scan_count ?? 0));
      accepted30 += row.sessions_with_consent ?? 0;
      declined30 += Math.max(0, (row.sessions_count ?? 0) - (row.sessions_with_consent ?? 0));
    }

    const scans30 = keys.map((k) => byDate.get(k) ?? 0);
    const scans7 = keys
      .filter((k) => k >= ymd(d7))
      .reduce((acc, k) => acc + (byDate.get(k) ?? 0), 0);
    const avgPerRestaurant = activeRestaurants.length > 0 ? scans7 / activeRestaurants.length : 0;
    const consentBase = accepted30 + declined30;
    const consentRate = consentBase > 0 ? (accepted30 / consentBase) * 100 : 0;

    return {
      labels,
      scans30,
      scans7,
      avgPerRestaurant,
      consentRate,
      activeHour: activeHour(data.scanEventsWeek),
      accepted30,
      declined30,
      monthImpressionsProjection: sumSafe(dailyRows.map((r) => r.scan_count)) * 30,
    };
  }, [activeRestaurants.length, dailyRows, data.scanEventsWeek]);

  const overviewAreaData = useMemo<ChartData<"line">>(
    () => ({
      labels: analyticsOverview.labels,
      datasets: [
        {
          label: "Gesamt-Scans",
          data: analyticsOverview.scans30,
          borderColor: C.teal,
          borderWidth: 2.2,
          pointRadius: 0,
          tension: 0.34,
          fill: true,
          backgroundColor: (ctx) => {
            const area = ctx.chart.chartArea;
            if (!area) return "rgba(0,200,160,0.2)";
            const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, "rgba(0,200,160,0.35)");
            g.addColorStop(1, "rgba(0,200,160,0)");
            return g;
          },
        },
      ],
    }),
    [analyticsOverview.labels, analyticsOverview.scans30],
  );

  const overviewAreaOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: "rgba(255,255,255,0.58)", maxRotation: 0 }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { beginAtZero: true, ticks: { color: "rgba(255,255,255,0.58)", precision: 0 }, grid: { color: "rgba(255,255,255,0.04)" } },
      },
    }),
    [],
  );

  const consentDonutData = useMemo<ChartData<"doughnut">>(
    () => ({
      labels: ["Accepted", "Declined"],
      datasets: [
        {
          data: [analyticsOverview.accepted30, analyticsOverview.declined30],
          backgroundColor: [C.teal, C.red],
          borderColor: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.15)"],
          borderWidth: 1,
        },
      ],
    }),
    [analyticsOverview.accepted30, analyticsOverview.declined30],
  );

  const consentDonutOptions = useMemo<ChartOptions<"doughnut">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { labels: { color: "rgba(255,255,255,0.7)" } },
      },
    }),
    [],
  );

  const restaurantAnalytics = useMemo(() => {
    const targetId = selectedRestaurantId;
    const selectedRows = dailyRows.filter((r) => r.restaurant_id === targetId);
    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    const keys: string[] = [];
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(d7);
      d.setDate(d7.getDate() + i);
      keys.push(ymd(d));
      labels.push(dateLabel(d.toISOString()));
    }
    const byDate = new Map<string, number>();
    for (const row of selectedRows) byDate.set(row.day_berlin, (byDate.get(row.day_berlin) ?? 0) + (row.scan_count ?? 0));
    const scans7 = keys.map((k) => byDate.get(k) ?? 0);

    const scansEvents = data.scanEventsWeek.filter((e) => e.restaurant_id === targetId);
    const buckets = { b0: 0, b6: 0, b12: 0, b18: 0 };
    for (const e of scansEvents) {
      const h = typeof e.stunde === "number" ? e.stunde : 0;
      if (h < 6) buckets.b0 += 1;
      else if (h < 12) buckets.b6 += 1;
      else if (h < 18) buckets.b12 += 1;
      else buckets.b18 += 1;
    }
    const tableMap = new Map<string, number>();
    const catMap = new Map<string, number>();
    for (const e of scansEvents) {
      const table = e.tisch_nummer != null ? `Tisch ${e.tisch_nummer}` : "Unbekannt";
      tableMap.set(table, (tableMap.get(table) ?? 0) + 1);
      const cat = e.kategorie?.trim() || "Unkategorisiert";
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    return {
      labels,
      scans7,
      dayparts: [
        { label: "0-6h", value: buckets.b0 },
        { label: "6-12h", value: buckets.b6 },
        { label: "12-18h", value: buckets.b12 },
        { label: "18-24h", value: buckets.b18 },
      ],
      topTables: topByCount(tableMap, 5),
      topCategories: topByCount(catMap, 5),
    };
  }, [data.scanEventsWeek, dailyRows, selectedRestaurantId]);

  const perRestaurantLineData = useMemo<ChartData<"line">>(
    () => ({
      labels: restaurantAnalytics.labels,
      datasets: [
        {
          label: "Scans",
          data: restaurantAnalytics.scans7,
          borderColor: C.orange,
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.33,
          fill: true,
          backgroundColor: "rgba(255,92,26,0.2)",
        },
      ],
    }),
    [restaurantAnalytics.labels, restaurantAnalytics.scans7],
  );

  const activeRestaurantName =
    data.restaurants.find((r) => r.id === selectedRestaurantId)?.name ?? "Restaurant";

  const rangeLabels = useMemo(() => {
    const out: string[] = [];
    for (let d = startOfDay(rangeFrom); d <= startOfDay(rangeTo); d = addDays(d, 1)) {
      out.push(dateLabel(d.toISOString()));
    }
    return out;
  }, [rangeFrom, rangeTo]);

  const today = startOfDay(new Date());
  const isPreset = (days: number): boolean => {
    const expectedFrom = addDays(today, -(days - 1));
    return sameDay(rangeTo, today) && sameDay(rangeFrom, expectedFrom);
  };

  const setPreset = (days: number): void => {
    setRangeTo(today);
    setRangeFrom(addDays(today, -(days - 1)));
    setPickerOpen(false);
    setRangeStartDraft(null);
  };

  function monthGrid(monthStart: Date): Array<Date | null> {
    const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const totalDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const prefix = mondayIndex(first.getDay());
    const cells: Array<Date | null> = [];
    for (let i = 0; i < prefix; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  const leftMonthGrid = monthGrid(leftMonth);
  const rightMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1);
  const rightMonthGrid = monthGrid(rightMonth);

  function inSelectedRange(day: Date): boolean {
    return day >= startOfDay(rangeFrom) && day <= startOfDay(rangeTo);
  }

  function onPickDay(day: Date): void {
    if (day > today) return;
    if (!rangeStartDraft) {
      setRangeStartDraft(day);
      return;
    }
    const from = day < rangeStartDraft ? day : rangeStartDraft;
    const to = day < rangeStartDraft ? rangeStartDraft : day;
    setRangeFrom(startOfDay(from));
    setRangeTo(startOfDay(to));
    setRangeStartDraft(null);
    setPickerOpen(false);
  }

  function pipelineStageColor(stage: string | null): string {
    const s = (stage ?? "").toLowerCase();
    if (s.includes("demo")) return C.orange;
    if (s.includes("follow")) return C.blue;
    if (s.includes("gew")) return C.teal;
    if (s.includes("verl")) return C.red;
    return C.yellow;
  }

  function pipelineHeatColor(waerme: string | null): string {
    const h = (waerme ?? "").toLowerCase();
    if (h.includes("hot")) return C.red;
    if (h.includes("kalt")) return C.blue;
    return C.yellow;
  }

  const liveRestaurants = data.restaurants.filter((r) => r.aktiv).length;
  const weeklyTempo = data.restaurants.filter((r) => {
    if (!r.created_at) return false;
    return new Date(r.created_at).getTime() >= addDays(today, -6).getTime();
  }).length;
  const avgScansPerRestaurant = liveRestaurants > 0 ? scansWeek / liveRestaurants : 0;
  const weeksToGoal = weeklyTempo > 0 ? Math.ceil(Math.max(0, 50 - liveRestaurants) / weeklyTempo) : null;

  function exportSelectedRestaurantCsv(): void {
    const header = ["date", "scans"];
    const rows = restaurantAnalytics.labels.map((label, i) => `${label},${restaurantAnalytics.scans7[i]}`);
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${activeRestaurantName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sidebarBtn = (active: boolean): React.CSSProperties => ({
    width: 38,
    height: 38,
    border: "none",
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: active ? "#fff" : "rgba(255,255,255,0.58)",
    background: active ? "rgba(255,255,255,0.08)" : "transparent",
    cursor: "default",
  });

  const mainTabBtn = (active: boolean, accent: string): React.CSSProperties => ({
    border: "none",
    borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
    background: active ? "rgba(255,255,255,0.08)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.72)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  });

  const subTabBtn = (active: boolean): React.CSSProperties => ({
    border: "none",
    borderBottom: active ? `2px solid ${C.teal}` : "2px solid transparent",
    background: active ? "rgba(255,255,255,0.08)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.72)",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div className={`${dmSans.className} relative min-h-screen`} style={{ background: "#080810", color: "#fff" }}>
      <div className="founder-bg-blobs" aria-hidden>
        <div className="founder-blob founder-blob--1" />
        <div className="founder-blob founder-blob--2" />
        <div className="founder-blob founder-blob--3" />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url("${noiseUrl}")`,
          backgroundRepeat: "repeat",
        }}
        aria-hidden
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh" }}>
        <aside
          style={{
            width: 54,
            flexShrink: 0,
            background: "rgba(255,255,255,0.025)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: 14,
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 2,
            display: isMobile ? "none" : "flex",
          }}
        >
          <div
            style={{
              marginBottom: 14,
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 64 64"
              fill="none"
              aria-hidden
              style={{ overflow: "visible", display: "block" }}
            >
              <path
                d="M31 6c14.36 0 26 11.64 26 26S45.36 58 31 58 5 46.36 5 32 16.64 6 31 6Zm0 12c-7.73 0-14 6.27-14 14s6.27 14 14 14 14-6.27 14-14-6.27-14-14-14Z"
                fill="#fff"
              />
              <path d="M6 38v20h14V44.5C14 42.6 9.4 40.4 6 38Z" fill="#fff" />
              <path d="M33 45.5 45.3 58H60L45.7 35.8C42.2 40.6 37.9 44.2 33 45.5Z" fill="#fff" />
            </svg>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <button
              type="button"
              style={sidebarBtn(mainTab === "overview")}
              aria-label="Übersicht"
              onClick={() => setMainTab("overview")}
            >
              <LayoutDashboard size={18} />
            </button>
            <button
              type="button"
              style={sidebarBtn(mainTab === "analytics")}
              aria-label="Analytics"
              onClick={() => setMainTab("analytics")}
            >
              <BarChart3 size={18} />
            </button>
            <button
              type="button"
              style={sidebarBtn(mainTab === "restaurants")}
              aria-label="Restaurants"
              onClick={() => setMainTab("restaurants")}
            >
              <Store size={18} />
            </button>
            <button
              type="button"
              style={sidebarBtn(mainTab === "todo")}
              aria-label="To-Do"
              onClick={() => setMainTab("todo")}
            >
              <Timer size={18} />
            </button>
            <button
              type="button"
              style={sidebarBtn(mainTab === "kontakte")}
              aria-label="Pipeline"
              onClick={() => setMainTab("kontakte")}
            >
              <Users size={18} />
            </button>
          </nav>
          <button type="button" style={sidebarBtn(false)} aria-label="User">
            <User size={18} />
          </button>
        </aside>

        <main
          style={{
            marginLeft: isMobile ? 0 : 54,
            width: isMobile ? "100%" : "calc(100% - 54px)",
            padding: "22px 20px 28px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: 1260, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>Founder Dashboard</h1>
                <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.62)", fontSize: 13 }}>
                  Live-Metriken aus Supabase
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                className="founder-card"
                style={{
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  cursor: refreshing ? "not-allowed" : "pointer",
                }}
              >
                {refreshing ? "Aktualisiere..." : "Aktualisieren"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => setMainTab("overview")} style={mainTabBtn(mainTab === "overview", C.teal)}>
                Übersicht
              </button>
              <button type="button" onClick={() => setMainTab("analytics")} style={mainTabBtn(mainTab === "analytics", C.orange)}>
                Analytics
              </button>
              <button type="button" onClick={() => setMainTab("restaurants")} style={mainTabBtn(mainTab === "restaurants", C.blue)}>
                Restaurants
              </button>
              <button type="button" onClick={() => setMainTab("todo")} style={mainTabBtn(mainTab === "todo", C.yellow)}>
                To-Do
              </button>
              <button type="button" onClick={() => setMainTab("kontakte")} style={mainTabBtn(mainTab === "kontakte", C.blue)}>
                Pipeline
              </button>
            </div>

            {loadError ? (
              <div className="founder-card" style={{ padding: 12, marginBottom: 14, color: C.red, fontSize: 12 }}>
                {loadError}
              </div>
            ) : null}

            {mainTab === "overview" ? (
              <>
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,minmax(0,1fr))",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  {[
                    {
                      t: "Restaurants Live",
                      v: `${data.restaurants.filter((r) => r.aktiv).length}`,
                      c: C.teal,
                      d: `${data.restaurants.filter((r) => r.aktiv).length} live`,
                      dc: C.green,
                    },
                    { t: "Besuche Heute", v: `${scansToday}`, c: C.orange, d: data.kpiDeltas.scansToday.text, dc: trendColor(data.kpiDeltas.scansToday) },
                    { t: "Scans 7 Tage", v: `${scansWeek}`, c: C.blue, d: data.kpiDeltas.scansWeek.text, dc: trendColor(data.kpiDeltas.scansWeek) },
                    { t: "Consent-Rate", v: `${consentRateWeek.toFixed(1)}%`, c: C.yellow, d: data.kpiDeltas.consent.text, dc: trendColor(data.kpiDeltas.consent) },
                  ].map((k) => (
                    <article key={k.t} className="founder-card" style={{ padding: 14, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>{k.t}</p>
                      <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 600, color: k.c }}>{k.v}</p>
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: k.dc }}>{k.d || "Keine Veränderung"}</p>
                      <div style={{ marginTop: 10, height: 1, width: "100%", background: k.c, boxShadow: `0 0 10px ${k.c}` }} />
                    </article>
                  ))}
                </section>

                <section className="founder-card" style={{ padding: 14, marginBottom: 14, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Scans aus scan_events</h2>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => setPickerOpen((v) => !v)} className="founder-card" style={{ padding: "8px 10px", fontSize: 12, color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
                        Von: {rangeFrom.toLocaleDateString("de-DE")}
                      </button>
                      <button type="button" onClick={() => setPickerOpen((v) => !v)} className="founder-card" style={{ padding: "8px 10px", fontSize: 12, color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
                        Bis: {rangeTo.toLocaleDateString("de-DE")}
                      </button>
                      {[7, 30, 90].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPreset(n)}
                          style={{
                            border: "none",
                            borderBottom: isPreset(n) ? `2px solid ${C.teal}` : "2px solid transparent",
                            background: isPreset(n) ? "rgba(255,255,255,0.08)" : "transparent",
                            color: "#fff",
                            borderRadius: 8,
                            fontSize: 11,
                            padding: "6px 9px",
                            cursor: "pointer",
                          }}
                        >
                          {n} Tage
                        </button>
                      ))}
                    </div>
                  </div>
                  {pickerOpen ? (
                    <div
                      className="founder-card"
                      style={{
                        position: "absolute",
                        right: 14,
                        top: 52,
                        zIndex: 20,
                        background: "#0f0f1a",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        backdropFilter: "blur(20px)",
                        padding: 12,
                        width: 620,
                        maxWidth: "calc(100% - 28px)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))} style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer" }}>‹</button>
                        <button type="button" onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))} style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer" }}>›</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[{ month: leftMonth, grid: leftMonthGrid }, { month: rightMonth, grid: rightMonthGrid }].map(({ month, grid }) => (
                          <div key={`${month.getFullYear()}-${month.getMonth()}`}>
                            <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
                              {month.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: 4 }}>
                              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                                <span key={d} style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>{d}</span>
                              ))}
                              {grid.map((day, idx) => {
                                if (!day) return <span key={idx} />;
                                const future = day > today;
                                const selected = sameDay(day, rangeFrom) || sameDay(day, rangeTo);
                                const inRange = inSelectedRange(day);
                                return (
                                  <button
                                    key={`${ymd(day)}-${idx}`}
                                    type="button"
                                    disabled={future}
                                    onClick={() => onPickDay(day)}
                                    style={{
                                      width: 36,
                                      height: 36,
                                      border: "none",
                                      borderRadius: 999,
                                      fontSize: 12,
                                      cursor: future ? "not-allowed" : "pointer",
                                      color: selected ? "#fff" : future ? "rgba(255,255,255,0.25)" : "#fff",
                                      background: selected ? C.teal : inRange ? "rgba(0,200,160,0.15)" : "transparent",
                                      position: "relative",
                                    }}
                                  >
                                    {day.getDate()}
                                    {sameDay(day, today) && !selected ? (
                                      <span style={{ position: "absolute", left: "50%", bottom: 4, width: 4, height: 4, borderRadius: 999, transform: "translateX(-50%)", background: C.orange }} />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ height: 230 }}>
                    <Line
                      data={{
                        labels: rangeLabels,
                        datasets: [
                          {
                            label: "Scans",
                            data: rangeScanSeries,
                            borderColor: C.teal,
                            pointRadius: 0,
                            tension: 0.34,
                            borderWidth: 2,
                            fill: true,
                            backgroundColor: "rgba(0,200,160,0.25)",
                          },
                        ],
                      }}
                      options={overviewAreaOptions}
                    />
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 14, marginBottom: 14 }}>
                  <article className="founder-card" style={{ padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Progress</h3>
                    <div style={{ marginTop: 12 }}>
                      {[
                        { t: "Live-Standorte", value: data.restaurants.filter((r) => r.aktiv).length, target: 50, c: C.teal },
                        { t: "Wochen-Besuche", value: scansWeek, target: 500, c: C.orange },
                      ].map((p) => {
                        const pct = p.target > 0 ? Math.min(100, (p.value / p.target) * 100) : 0;
                        return (
                          <div key={p.t} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                              <span>{p.t}</span>
                              <span style={{ color: "rgba(255,255,255,0.65)" }}>
                                {p.value} / {p.target}
                              </span>
                            </div>
                            <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: p.c }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                  <article className="founder-card" style={{ padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Consent Donut</h3>
                    <div style={{ height: 180, marginTop: 8 }}>
                      <Doughnut
                        data={{
                          labels: ["Accepted", "Declined"],
                          datasets: [
                            {
                              data: [consentAcceptedWeek, Math.max(0, consentLikeWeek.length - consentAcceptedWeek)],
                              backgroundColor: [C.teal, C.red],
                              borderColor: ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.12)"],
                              borderWidth: 1,
                            },
                          ],
                        }}
                        options={consentDonutOptions}
                      />
                    </div>
                  </article>
                </section>

                <section className="founder-card" style={{ padding: 10, display: "inline-flex", gap: 8, alignItems: "center", borderColor: "rgba(0,200,160,0.4)", marginBottom: 14 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: C.teal, boxShadow: `0 0 8px ${C.teal}` }} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                    Phase 1 — Frankfurt {data.restaurants.filter((r) => r.aktiv).length}/50
                  </span>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                  <article className="founder-card" style={{ padding: 14 }}>
                    <div style={{ height: 2, background: C.orange, borderRadius: 999, marginBottom: 10 }} />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Offene Aufgaben</h3>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {previewTodos.slice(0, 5).map((t) => (
                        <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: t.done ? 0.4 : 1 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(t.done)}
                            onChange={() => {
                              setPreviewTodos((prev) => prev.filter((x) => x.id !== t.id));
                              void supabase.from("todos").update({ done: true, status: "done" }).eq("id", t.id);
                            }}
                            style={{ accentColor: C.teal }}
                          />
                          <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => setMainTab("todo")} style={{ marginTop: 10, border: "none", background: "transparent", color: C.orange, fontSize: 12, cursor: "pointer", padding: 0 }}>
                      → Alle Tasks
                    </button>
                  </article>

                  <article className="founder-card" style={{ padding: 14 }}>
                    <div style={{ height: 2, background: C.blue, borderRadius: 999, marginBottom: 10 }} />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Pipeline</h3>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {previewPipeline.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                          Noch keine Kontakte — füge deinen ersten Pitch hinzu
                        </p>
                      ) : (
                        previewPipeline.map((p) => (
                          <div key={p.id} className="founder-card" style={{ padding: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <strong style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</strong>
                              <span style={{ fontSize: 10, padding: "3px 6px", borderRadius: 999, background: `${pipelineStageColor(p.stage)}22`, color: pipelineStageColor(p.stage) }}>
                                {p.stage ?? "Kontaktiert"}
                              </span>
                              <span style={{ fontSize: 10, padding: "3px 6px", borderRadius: 999, background: `${pipelineHeatColor(p.waerme)}22`, color: pipelineHeatColor(p.waerme) }}>
                                {p.waerme ?? "Warm"}
                              </span>
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.62)" }}>{p.next_action ?? "—"}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <button type="button" onClick={() => setMainTab("kontakte")} style={{ marginTop: 10, border: "none", background: "transparent", color: C.blue, fontSize: 12, cursor: "pointer", padding: 0 }}>
                      → Ganze Pipeline
                    </button>
                    {pipelineTableMissing ? (
                      <pre style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.62)", whiteSpace: "pre-wrap" }}>
{`create table if not exists pipeline (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'Kontaktiert',
  notes text,
  next_action text,
  created_at timestamptz default now()
);`}
                      </pre>
                    ) : null}
                  </article>

                  <article className="founder-card" style={{ padding: 14 }}>
                    <div style={{ height: 2, background: C.teal, borderRadius: 999, marginBottom: 10 }} />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Phase 1 — Frankfurt</h3>
                    <p style={{ margin: "8px 0 0", fontSize: 28, color: C.teal, fontWeight: 600 }}>
                      {liveRestaurants}/50
                    </p>
                    <div style={{ marginTop: 10, position: "relative", height: 34 }}>
                      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", position: "absolute", left: 0, right: 0, top: 14 }}>
                        <div style={{ width: `${Math.min(100, (liveRestaurants / 50) * 100)}%`, height: "100%", borderRadius: 999, background: C.teal }} />
                      </div>
                      {[10, 25, 50].map((m) => (
                        <span key={m} style={{ position: "absolute", top: 11, left: `calc(${(m / 50) * 100}% - 1px)`, width: 2, height: 14, background: "rgba(255,255,255,0.35)" }} />
                      ))}
                      <span style={{ position: "absolute", top: 0, left: `calc(${Math.min(100, (liveRestaurants / 50) * 100)}% - 18px)`, background: C.teal, color: "#fff", borderRadius: 999, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>
                        {liveRestaurants}
                      </span>
                    </div>
                    <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>Ø Scans / Restaurant</span>
                        <strong style={{ color: C.teal }}>{avgScansPerRestaurant.toFixed(1)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>Tempo</span>
                        <strong style={{ color: C.teal }}>{weeklyTempo} neue Restaurants diese Woche</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>Hochrechnung</span>
                        <strong style={{ color: C.teal }}>{weeksToGoal == null ? "—" : `Phase 1 erreicht in ca. ${weeksToGoal} Wochen`}</strong>
                      </div>
                    </div>
                  </article>
                </section>
              </>
            ) : null}

            {mainTab === "restaurants" ? (
              <section>
                <RestaurantsTab
                  restaurants={data.restaurants}
                  scanEvents={data.scanEventsWeek}
                  restaurantExtras={data.restaurantExtras}
                  restaurantTables={data.restaurantTables}
                  isMobile={Boolean(isMobile)}
                  onRefresh={refreshAll}
                />
              </section>
            ) : null}

            {mainTab === "todo" ? (
              <section>
                <TodoTab todos={data.todos} isMobile={Boolean(isMobile)} onRefresh={refreshAll} />
              </section>
            ) : null}

            {mainTab === "kontakte" ? (
              <section>
                <KontakteTab isMobile={Boolean(isMobile)} onRefresh={refreshAll} />
              </section>
            ) : null}

            {mainTab === "analytics" ? (
              <section className="founder-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => setAnalyticsSubTab("overview")} style={subTabBtn(analyticsSubTab === "overview")}>
                    Übersicht
                  </button>
                  <button type="button" onClick={() => setAnalyticsSubTab("restaurant")} style={subTabBtn(analyticsSubTab === "restaurant")}>
                    Pro Restaurant
                  </button>
                  <button type="button" onClick={() => setAnalyticsSubTab("abtests")} style={subTabBtn(analyticsSubTab === "abtests")}>
                    A/B Tests
                  </button>
                  <button type="button" onClick={() => setAnalyticsSubTab("partners")} style={subTabBtn(analyticsSubTab === "partners")}>
                    Werbepartner
                  </button>
                </div>

                {analyticsSubTab === "overview" ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 14 }}>
                      {[
                        { t: "Gesamt-Scans (7 Tage)", v: `${analyticsOverview.scans7}`, c: C.teal },
                        { t: "Ø Scans pro Restaurant", v: `${analyticsOverview.avgPerRestaurant.toFixed(1)}`, c: C.orange },
                        { t: "Consent-Rate", v: `${analyticsOverview.consentRate.toFixed(1)}%`, c: C.blue },
                        { t: "Aktivste Tageszeit", v: analyticsOverview.activeHour, c: C.yellow },
                      ].map((k) => (
                        <article key={k.t} className="founder-card" style={{ padding: 12 }}>
                          <p style={{ margin: 0, color: "rgba(255,255,255,0.62)", fontSize: 12 }}>{k.t}</p>
                          <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 600, color: k.c }}>{k.v}</p>
                        </article>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
                      <article className="founder-card" style={{ padding: 14, minHeight: 280 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <TrendingUp size={18} color={C.teal} />
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Gesamt-Scans letzte 30 Tage</h3>
                        </div>
                        <div style={{ height: 220 }}>
                          <Line data={overviewAreaData} options={overviewAreaOptions} />
                        </div>
                      </article>
                      <article className="founder-card" style={{ padding: 14, minHeight: 280 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Consent Donut</h3>
                        <div style={{ height: 220 }}>
                          <Doughnut data={consentDonutData} options={consentDonutOptions} />
                        </div>
                      </article>
                    </div>
                  </>
                ) : null}

                {analyticsSubTab === "restaurant" ? (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      {activeRestaurants.length === 0 ? (
                        <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Keine aktiven Restaurants.</span>
                      ) : (
                        activeRestaurants.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedRestaurantId(r.id)}
                            style={{
                              border: "1px solid rgba(255,255,255,0.14)",
                              background: selectedRestaurantId === r.id ? "rgba(255,255,255,0.08)" : "transparent",
                              color: "#fff",
                              borderRadius: 999,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {r.name}
                          </button>
                        ))
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
                      <article className="founder-card" style={{ padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Scans letzte 7 Tage</h3>
                          <button
                            type="button"
                            onClick={exportSelectedRestaurantCsv}
                            className="founder-card"
                            style={{ border: "1px dashed rgba(255,255,255,0.35)", padding: "7px 10px", fontSize: 11, color: "#fff", cursor: "pointer" }}
                          >
                            <FileSpreadsheet size={12} style={{ display: "inline", marginRight: 6 }} />
                            CSV Export
                          </button>
                        </div>
                        <div style={{ height: 200 }}>
                          <Line data={perRestaurantLineData} options={overviewAreaOptions} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 12 }}>
                          {restaurantAnalytics.dayparts.map((d, idx) => (
                            <div key={d.label} className="founder-card" style={{ padding: 10 }}>
                              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.58)" }}>{d.label}</p>
                              <p style={{ margin: "4px 0 0", fontSize: 18, color: [C.teal, C.orange, C.blue, C.yellow][idx], fontWeight: 600 }}>
                                {d.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="founder-card" style={{ padding: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Top 5 Tische</h3>
                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {restaurantAnalytics.topTables.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Keine Daten</p>
                          ) : (
                            restaurantAnalytics.topTables.map((t) => (
                              <div key={t.key} className="founder-card" style={{ padding: 10, display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 12 }}>{t.key}</span>
                                <strong style={{ fontSize: 12 }}>{t.count}</strong>
                              </div>
                            ))
                          )}
                        </div>
                        <h3 style={{ margin: "14px 0 0", fontSize: 15, fontWeight: 600 }}>Menü-Performance</h3>
                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {restaurantAnalytics.topCategories.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Keine Daten</p>
                          ) : (
                            restaurantAnalytics.topCategories.map((c, idx) => (
                              <div key={c.key}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                  <span>{c.key}</span>
                                  <span style={{ color: "rgba(255,255,255,0.62)" }}>{c.count}</span>
                                </div>
                                <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                                  <div
                                    style={{
                                      width: `${restaurantAnalytics.topCategories[0]?.count ? (c.count / restaurantAnalytics.topCategories[0].count) * 100 : 0}%`,
                                      height: "100%",
                                      borderRadius: 999,
                                      background: [C.teal, C.orange, C.blue, C.yellow][idx % 4],
                                    }}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </article>
                    </div>
                  </>
                ) : null}

                {analyticsSubTab === "abtests" ? (
                  <article
                    className="founder-card"
                    style={{
                      border: `1px dashed ${C.orange}`,
                      minHeight: 210,
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      color: C.orange,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Kommt in Phase 2</p>
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                        Verfügbar ab 50 Restaurants
                      </p>
                    </div>
                  </article>
                ) : null}

                {analyticsSubTab === "partners" ? (
                  <article
                    className="founder-card"
                    style={{
                      border: `1px dashed ${C.teal}`,
                      minHeight: 230,
                      display: "grid",
                      alignItems: "center",
                      textAlign: "center",
                      padding: 24,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.teal }}>Werbepartner</p>
                      <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.68)" }}>
                        Kommt ab ~50 Restaurants — Heineken, Red Bull, Coca-Cola
                      </p>
                      <p style={{ margin: "16px 0 0", fontSize: 13, color: "rgba(255,255,255,0.68)" }}>
                        Monatsimpressionen-Hochrechnung
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 34, color: C.teal, fontWeight: 600 }}>
                        {analyticsOverview.monthImpressionsProjection.toLocaleString("de-DE")}
                      </p>
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

