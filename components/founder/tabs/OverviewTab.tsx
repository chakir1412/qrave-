"use client";

import type {
  FounderDashboardData,
  FounderPipelineRow,
  FounderTodoRow,
} from "@/lib/founder-types";
import { FOUNDER_DESKTOP_MEDIA, useMediaQuery } from "@/hooks/useMediaQuery";
import { founderDash, founderGlassCard } from "../constants";

function heatScore(heat: string | null | undefined): number {
  const h = (heat ?? "").toLowerCase();
  if (h === "hot" || h === "heiß" || h === "heiss") return 3;
  if (h === "warm") return 2;
  if (h === "cold" || h === "kalt") return 1;
  return 0;
}

function startOfLocalDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type Props = {
  data: FounderDashboardData;
};

export function OverviewTab({ data }: Props) {
  const isDesktop = useMediaQuery(FOUNDER_DESKTOP_MEDIA);
  const total = data.restaurants.length;
  const aktiv = data.restaurants.filter((r) => r.aktiv).length;
  const pct = total === 0 ? 0 : Math.round((aktiv / total) * 100);

  const day0 = startOfLocalDay().getTime();
  const scansToday = data.scanEvents.filter((e) => new Date(e.created_at).getTime() >= day0).length;

  const openTodos: FounderTodoRow[] = data.todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      const pr: Record<string, number> = { h: 0, m: 1, l: 2 };
      return (pr[a.prio ?? "m"] ?? 1) - (pr[b.prio ?? "m"] ?? 1);
    });

  const hottest: FounderPipelineRow | null = [...data.pipeline].sort(
    (a, b) => heatScore(b.heat) - heatScore(a.heat),
  )[0] ?? null;

  const cardBase = { ...founderGlassCard };
  const statTitle = "text-sm font-extrabold tracking-wide";
  const statBig = isDesktop ? "text-4xl font-black tabular-nums" : "text-3xl font-black tabular-nums";

  return (
    <div
      className={
        isDesktop
          ? "flex flex-col gap-6 pb-4"
          : "flex flex-col gap-4 pb-28"
      }
    >
      <div
        className={isDesktop ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-4"}
      >
        <section className="p-5" style={cardBase}>
          <h2 className={statTitle} style={{ color: founderDash.or }}>
            Restaurants live
          </h2>
          <p className={`mt-2 ${isDesktop ? "text-3xl" : "text-2xl"} font-black tabular-nums`} style={{ color: founderDash.tx }}>
            {aktiv}{" "}
            <span className="text-sm font-semibold" style={{ color: founderDash.mu }}>
              / {total}
            </span>
          </p>
          <div
            className={`mt-4 h-2.5 w-full overflow-hidden rounded-full ${isDesktop ? "max-w-md" : ""}`}
            style={{ backgroundColor: founderDash.s3 }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${founderDash.or}, ${founderDash.or2})`,
              }}
            />
          </div>
          <p className="mt-3 text-xs" style={{ color: founderDash.mu }}>
            {pct}% aktiv · Daten aus Supabase
          </p>
        </section>

        <section className="p-5" style={cardBase}>
          <h2 className={statTitle} style={{ color: founderDash.or }}>
            Scans heute
          </h2>
          <p className={`mt-2 ${statBig}`} style={{ color: founderDash.tx }}>
            {scansToday}
          </p>
          <p className="mt-2 text-xs" style={{ color: founderDash.mu }}>
            Aus scan_events (lokal heute, 0:00 Uhr)
          </p>
        </section>

        <section className={`p-5 ${isDesktop ? "xl:col-span-1" : ""}`} style={cardBase}>
          <h2 className={statTitle} style={{ color: founderDash.or }}>
            Leads in Pipeline
          </h2>
          <p className={`mt-2 ${statBig}`} style={{ color: founderDash.tx }}>
            {data.pipeline.length}
          </p>
          <p className="mt-2 text-xs" style={{ color: founderDash.mu }}>
            Founder-Kontakte gesamt
          </p>
        </section>
      </div>

      <section
        className={`p-5 ${isDesktop ? "min-h-[280px]" : ""}`}
        style={cardBase}
      >
        <h2 className="mb-4 text-sm font-extrabold tracking-wide" style={{ color: founderDash.or }}>
          Nächste Schritte
        </h2>
        <div
          className={
            isDesktop
              ? "grid gap-6 lg:grid-cols-2"
              : "flex flex-col gap-4"
          }
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: founderDash.mu }}>
              Offene To-Dos
            </p>
            <ul className={`mt-3 space-y-2 ${isDesktop ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
              {openTodos.slice(0, isDesktop ? 12 : 5).map((t) => (
                <li
                  key={t.id}
                  className="px-4 py-3 text-sm"
                  style={{
                    ...founderGlassCard,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  <span className="font-semibold" style={{ color: founderDash.tx }}>
                    {t.text}
                  </span>
                  {t.sub ? (
                    <span className="mt-1 block text-xs" style={{ color: founderDash.mu }}>
                      {t.sub}
                    </span>
                  ) : null}
                </li>
              ))}
              {openTodos.length === 0 ? (
                <li className="text-xs" style={{ color: founderDash.mu }}>
                  Keine offenen Todos.
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: founderDash.mu }}>
              Heißester Lead
            </p>
            {hottest ? (
              <div
                className="mt-3 px-4 py-4"
                style={{
                  ...founderGlassCard,
                  borderRadius: 16,
                  background: "rgba(255,92,26,0.08)",
                  borderColor: founderDash.orm,
                }}
              >
                <div className={`font-bold ${isDesktop ? "text-lg" : ""}`} style={{ color: founderDash.tx }}>
                  {hottest.name}
                </div>
                <div className="mt-2 text-xs" style={{ color: founderDash.mu }}>
                  Heat: {hottest.heat ?? "—"} · Stage: {hottest.stage ?? "—"}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs" style={{ color: founderDash.mu }}>
                Noch keine Pipeline-Einträge.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
