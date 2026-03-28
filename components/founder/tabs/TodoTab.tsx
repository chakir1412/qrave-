"use client";

import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type { FounderTodoRow } from "@/lib/founder-types";
import { fp } from "../founder-palette";

type Prio = "h" | "m" | "l";

function nextPrio(p: string | null | undefined): Prio {
  const cur = (p ?? "m").toLowerCase();
  if (cur === "h") return "m";
  if (cur === "m") return "l";
  return "h";
}

function prioDotColor(p: string | null | undefined): string {
  const v = (p ?? "m").toLowerCase();
  if (v === "h") return fp.red;
  if (v === "l") return "rgba(255,255,255,0.28)";
  return fp.yellow;
}

type Props = {
  todos: FounderTodoRow[];
  isMobile: boolean;
  onRefresh: () => Promise<void>;
};

const cardShell: CSSProperties = {
  background: fp.card,
  borderRadius: 16,
  border: `1px solid ${fp.line}`,
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${fp.line}`,
  background: "rgba(0,0,0,0.25)",
  color: fp.tx,
  fontSize: 13,
  outline: "none",
};

export function TodoTab({ todos, isMobile, onRefresh }: Props) {
  const [text, setText] = useState("");
  const [sub, setSub] = useState("");
  const [prio, setPrio] = useState<Prio>("m");
  const [pending, setPending] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const touchRef = useRef<{ x: number; id: string } | null>(null);

  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pr: Record<string, number> = { h: 0, m: 1, l: 2 };
    return (pr[a.prio ?? "m"] ?? 1) - (pr[b.prio ?? "m"] ?? 1);
  });

  const run = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>) => {
      setPending(true);
      try {
        const { error } = await Promise.resolve(op);
        if (error) {
          window.alert(error.message);
          return;
        }
        await onRefresh();
      } finally {
        setPending(false);
      }
    },
    [onRefresh],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-6">
      <div style={{ ...cardShell, padding: isMobile ? 14 : 22 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: fp.or }}>Neues To-Do</h3>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Aufgabe"
          style={{ ...inputStyle, marginTop: 14 }}
        />
        <input
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          placeholder="Untertitel (optional)"
          style={inputStyle}
        />
        <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
          Priorität
          <select
            value={prio}
            onChange={(e) => setPrio(e.target.value as Prio)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="h">Hoch</option>
            <option value="m">Mittel</option>
            <option value="l">Niedrig</option>
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() =>
            void run(
              supabase.from("founder_todos").insert({ text: text.trim(), sub: sub.trim() || null, prio }),
            ).then(() => {
              setText("");
              setSub("");
              setPrio("m");
            })
          }
          style={{
            marginTop: 18,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            fontWeight: 800,
            fontSize: 14,
            color: "#fff",
            cursor: pending || !text.trim() ? "not-allowed" : "pointer",
            opacity: pending || !text.trim() ? 0.5 : 1,
            background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
            boxShadow: `0 8px 24px ${fp.or}44`,
          }}
        >
          Hinzufügen
        </button>
      </div>

      <div style={{ ...cardShell, padding: "8px 0" }}>
        {sorted.length === 0 ? (
          <p style={{ padding: "20px 22px", margin: 0, color: fp.mu, fontSize: 14 }}>Keine To-Dos.</p>
        ) : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sorted.map((t) => {
            const showDelete =
              (isMobile && swipedId === t.id) || (!isMobile && hoverId === t.id);
            return (
              <li
                key={t.id}
                style={{
                  borderBottom: `1px solid ${fp.line}`,
                  padding: isMobile ? "12px 14px" : "14px 18px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={() => !isMobile && setHoverId(t.id)}
                onMouseLeave={() => !isMobile && setHoverId(null)}
                onTouchStart={(e) => {
                  touchRef.current = { x: e.touches[0]?.clientX ?? 0, id: t.id };
                }}
                onTouchEnd={(e) => {
                  const start = touchRef.current;
                  touchRef.current = null;
                  if (!start || start.id !== t.id) return;
                  const endX = e.changedTouches[0]?.clientX ?? start.x;
                  if (start.x - endX > 56) setSwipedId(t.id);
                  else if (endX - start.x > 40) setSwipedId(null);
                }}
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void run(supabase.from("founder_todos").update({ done: !t.done }).eq("id", t.id))}
                  aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
                  style={{
                    width: 22,
                    height: 22,
                    marginTop: 2,
                    borderRadius: 6,
                    border: `2px solid ${t.done ? fp.green : fp.line2}`,
                    background: t.done ? fp.green : "transparent",
                    cursor: pending ? "not-allowed" : "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0c0c0f",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {t.done ? "✓" : ""}
                </button>
                <span
                  title="Priorität wechseln"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    marginTop: 8,
                    background: prioDotColor(t.prio),
                    flexShrink: 0,
                    cursor: pending ? "not-allowed" : "pointer",
                    boxShadow: `0 0 10px ${prioDotColor(t.prio)}66`,
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    void run(supabase.from("founder_todos").update({ prio: nextPrio(t.prio) }).eq("id", t.id))
                  }
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !pending) {
                      e.preventDefault();
                      void run(supabase.from("founder_todos").update({ prio: nextPrio(t.prio) }).eq("id", t.id));
                    }
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    style={{
                      fontSize: isMobile ? 14 : 15,
                      fontWeight: 700,
                      color: fp.tx,
                      textDecoration: t.done ? "line-through" : "none",
                      opacity: t.done ? 0.45 : 1,
                    }}
                  >
                    {t.text}
                  </div>
                  {t.sub ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: fp.mu }}>{t.sub}</div>
                  ) : null}
                </div>
                {showDelete ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(supabase.from("founder_todos").delete().eq("id", t.id)).then(() => setSwipedId(null))
                    }
                    style={{
                      flexShrink: 0,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "none",
                      background: fp.red,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: pending ? "not-allowed" : "pointer",
                    }}
                  >
                    Löschen
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
