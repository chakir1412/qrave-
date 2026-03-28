"use client";

import { useState } from "react";
import type { FounderTodoRow } from "@/lib/founder-types";
import { FOUNDER_DESKTOP_MEDIA, useMediaQuery } from "@/hooks/useMediaQuery";
import { founderDash, founderGlassCard } from "../constants";

type Prio = "h" | "m" | "l";

function nextPrio(p: string | null | undefined): Prio {
  const cur = (p ?? "m").toLowerCase();
  if (cur === "h") return "m";
  if (cur === "m") return "l";
  return "h";
}

function prioLabel(p: string | null | undefined): string {
  const v = (p ?? "m").toLowerCase();
  if (v === "h") return "Hoch";
  if (v === "l") return "Niedrig";
  return "Mittel";
}

type Props = {
  todos: FounderTodoRow[];
  busy: boolean;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onPrio: (id: string, prio: Prio) => Promise<void>;
  onAdd: (text: string, sub: string, prio: Prio) => Promise<void>;
};

export function TodoTab({ todos, busy, onToggle, onPrio, onAdd }: Props) {
  const isDesktop = useMediaQuery(FOUNDER_DESKTOP_MEDIA);
  const [text, setText] = useState("");
  const [sub, setSub] = useState("");
  const [prio, setPrio] = useState<Prio>("m");

  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pr: Record<string, number> = { h: 0, m: 1, l: 2 };
    return (pr[a.prio ?? "m"] ?? 1) - (pr[b.prio ?? "m"] ?? 1);
  });

  return (
    <div
      className={
        isDesktop
          ? "mx-auto flex w-full max-w-3xl flex-col gap-6 pb-4"
          : "flex flex-col gap-4 pb-28"
      }
    >
      <section className={isDesktop ? "p-6" : "p-4"} style={founderGlassCard}>
        <h3 className="text-sm font-extrabold" style={{ color: founderDash.or }}>
          Neues To-Do
        </h3>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Aufgabe"
          className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none md:py-3 md:text-base"
          style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
        />
        <input
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          placeholder="Untertitel (optional)"
          className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none md:py-3"
          style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
        />
        <select
          value={prio}
          onChange={(e) => setPrio(e.target.value as Prio)}
          className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none md:py-3"
          style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
        >
          <option value="h">Priorität: Hoch</option>
          <option value="m">Priorität: Mittel</option>
          <option value="l">Priorität: Niedrig</option>
        </select>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() =>
            void onAdd(text.trim(), sub.trim(), prio).then(() => {
              setText("");
              setSub("");
              setPrio("m");
            })
          }
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 md:py-3.5 md:text-base"
          style={{ background: `linear-gradient(135deg, ${founderDash.or}, ${founderDash.or2})` }}
        >
          Hinzufügen
        </button>
      </section>

      <div className={isDesktop ? "space-y-3" : "space-y-2"}>
        {sorted.map((t) => (
          <div
            key={t.id}
            className={isDesktop ? "flex gap-4 rounded-[20px] border p-4" : "flex gap-3 rounded-[20px] border p-3"}
            style={{
              ...founderGlassCard,
              opacity: t.done ? 0.55 : 1,
            }}
          >
            <button
              type="button"
              onClick={() => void onToggle(t.id, !t.done)}
              className={`mt-0.5 flex shrink-0 items-center justify-center rounded-md border text-xs font-bold ${isDesktop ? "h-8 w-8 text-sm" : "h-6 w-6"}`}
              style={{
                borderColor: founderDash.orm,
                color: t.done ? founderDash.gr : founderDash.mu,
                backgroundColor: founderDash.s2,
              }}
              aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
            >
              {t.done ? "✓" : ""}
            </button>
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${isDesktop ? "text-base" : ""}`} style={{ color: founderDash.tx }}>
                {t.text}
              </div>
              {t.sub ? (
                <div className={`text-xs ${isDesktop ? "mt-1 text-sm" : ""}`} style={{ color: founderDash.mu }}>
                  {t.sub}
                </div>
              ) : null}
              <div className={`mt-2 flex flex-wrap gap-2 ${isDesktop ? "mt-3" : ""}`}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onPrio(t.id, nextPrio(t.prio))}
                  className={`rounded-lg border font-bold uppercase ${isDesktop ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]"}`}
                  style={{ borderColor: founderDash.bo, color: founderDash.or }}
                >
                  Prio: {prioLabel(t.prio)}
                </button>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 ? (
          <p className="text-center text-xs" style={{ color: founderDash.mu }}>
            Keine Todos.
          </p>
        ) : null}
      </div>
    </div>
  );
}
