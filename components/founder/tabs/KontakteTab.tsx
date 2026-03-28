"use client";

import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type { FounderPipelineRow } from "@/lib/founder-types";
import { fp } from "../founder-palette";

const STAGES = [
  { key: "kontakt", label: "Kontakt" },
  { key: "demo", label: "Demo" },
  { key: "followup", label: "Follow-up" },
  { key: "gewonnen", label: "Gewonnen" },
  { key: "verloren", label: "Verloren" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

type Props = {
  pipeline: FounderPipelineRow[];
  isMobile: boolean;
  onRefresh: () => Promise<void>;
};

function heatBorderColor(heat: string | null | undefined): string {
  const h = (heat ?? "").toLowerCase();
  if (h === "hot" || h === "heiß" || h === "heiss") return fp.red;
  if (h === "warm") return fp.yellow;
  return "rgba(255,255,255,0.18)";
}

function heatLabel(heat: string | null | undefined): string {
  const h = (heat ?? "").toLowerCase();
  if (h === "hot" || h === "heiß" || h === "heiss") return "Hot";
  if (h === "warm") return "Warm";
  return "Kalt";
}

const LEGACY_STAGE: Record<string, StageKey> = {
  contact: "kontakt",
  trial: "demo",
  won: "gewonnen",
  lost: "verloren",
};

function normalizeStageKey(stage: string | null | undefined): StageKey {
  const s = (stage ?? "kontakt").toLowerCase();
  if (LEGACY_STAGE[s]) return LEGACY_STAGE[s];
  if (STAGES.some((x) => x.key === s)) return s as StageKey;
  return "kontakt";
}

function stageLabel(stage: string | null | undefined): string {
  const k = normalizeStageKey(stage);
  return STAGES.find((x) => x.key === k)?.label ?? "Kontakt";
}

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

export function KontakteTab({ pipeline, isMobile, onRefresh }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [stageMenuId, setStageMenuId] = useState<string | null>(null);
  const touchRef = useRef<{ x: number; id: string } | null>(null);

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [heat, setHeat] = useState<"hot" | "warm" | "cold">("warm");
  const [stage, setStage] = useState<StageKey>("kontakt");

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

  const formContent = (
    <>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: fp.tx }}>Neuer Kontakt</h3>
      <label style={{ display: "block", marginTop: 14, fontSize: 11, fontWeight: 700, color: fp.mu }}>
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
        Bezirk / Area
        <input value={area} onChange={(e) => setArea(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
        Telefon
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
      </label>
      <p style={{ margin: "14px 0 6px", fontSize: 11, fontWeight: 700, color: fp.mu }}>Heat</p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { k: "hot" as const, lab: "Hot" },
            { k: "warm" as const, lab: "Warm" },
            { k: "cold" as const, lab: "Kalt" },
          ] as const
        ).map((h) => (
          <button
            key={h.k}
            type="button"
            onClick={() => setHeat(h.k)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${heat === h.k ? fp.or : fp.line}`,
              background: heat === h.k ? "rgba(255,92,26,0.15)" : "transparent",
              color: heat === h.k ? fp.or : fp.mi,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {h.lab}
          </button>
        ))}
      </div>
      <p style={{ margin: "14px 0 6px", fontSize: 11, fontWeight: 700, color: fp.mu }}>Stage</p>
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStage(s.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${stage === s.key ? fp.blue : fp.line}`,
              background: stage === s.key ? "rgba(91,155,255,0.12)" : "transparent",
              color: stage === s.key ? fp.blue : fp.mi,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={pending || !name.trim()}
        onClick={() =>
          void run(
            supabase.from("founder_pipeline").insert({
              name: name.trim(),
              area: area.trim() || null,
              phone: phone.trim() || null,
              contact: null,
              heat,
              stage,
            }),
          ).then(() => {
            setName("");
            setArea("");
            setPhone("");
            setHeat("warm");
            setStage("kontakt");
            setSheetOpen(false);
          })
        }
        style={{
          marginTop: 20,
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "none",
          fontWeight: 800,
          fontSize: 14,
          color: "#fff",
          cursor: pending || !name.trim() ? "not-allowed" : "pointer",
          opacity: pending || !name.trim() ? 0.5 : 1,
          background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
          boxShadow: `0 8px 24px ${fp.or}44`,
        }}
      >
        Speichern
      </button>
    </>
  );

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: `1px solid ${fp.or}55`,
            background: "rgba(255,92,26,0.12)",
            color: fp.or,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Kontakt
        </button>
      </div>

      {sheetOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Schließen"
            style={{ position: "absolute", inset: 0, border: "none", cursor: "default", background: "transparent" }}
            onClick={() => !pending && setSheetOpen(false)}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 440,
              maxHeight: isMobile ? "88vh" : "90vh",
              overflow: "auto",
              borderRadius: isMobile ? "20px 20px 0 0" : 18,
              ...cardShell,
              padding: isMobile ? 20 : 24,
              marginTop: isMobile ? 0 : 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !pending && setSheetOpen(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                border: `1px solid ${fp.line}`,
                borderRadius: 8,
                padding: "4px 10px",
                background: "transparent",
                color: fp.mu,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            {formContent}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {pipeline.length === 0 ? (
          <p style={{ color: fp.mu, fontSize: 14 }}>Noch keine Einträge in der Pipeline.</p>
        ) : null}
        {pipeline.map((p) => {
          const borderC = heatBorderColor(p.heat);
          const showDelete = (isMobile && swipedId === p.id) || (!isMobile && hoverId === p.id);
          const menuOpen = stageMenuId === p.id;
          const curStage = normalizeStageKey(p.stage);

          return (
            <div
              key={p.id}
              style={{
                ...cardShell,
                padding: isMobile ? "14px 14px 14px 12px" : "18px 20px 18px 16px",
                borderLeft: `4px solid ${borderC}`,
                position: "relative",
              }}
              onMouseEnter={() => !isMobile && setHoverId(p.id)}
              onMouseLeave={() => !isMobile && setHoverId(null)}
              onTouchStart={(e) => {
                touchRef.current = { x: e.touches[0]?.clientX ?? 0, id: p.id };
              }}
              onTouchEnd={(e) => {
                const start = touchRef.current;
                touchRef.current = null;
                if (!start || start.id !== p.id) return;
                const endX = e.changedTouches[0]?.clientX ?? start.x;
                if (start.x - endX > 56) setSwipedId(p.id);
                else if (endX - start.x > 40) setSwipedId(null);
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 16, fontWeight: 800, color: fp.tx }}>{p.name}</div>
                  <div className="mt-1 flex flex-wrap gap-3" style={{ fontSize: 12, color: fp.mu }}>
                    {p.area ? <span>{p.area}</span> : null}
                    {p.phone ? <span>{p.phone}</span> : null}
                  </div>
                  {p.note ? (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: fp.mi, lineHeight: 1.45 }}>{p.note}</p>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 9999,
                      background: "rgba(255,255,255,0.06)",
                      color: borderC,
                      border: `1px solid ${borderC}55`,
                    }}
                  >
                    {heatLabel(p.heat)}
                  </span>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setStageMenuId(menuOpen ? null : p.id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: fp.blue,
                        border: `1px solid ${fp.line}`,
                        borderRadius: 9999,
                        padding: "6px 12px",
                        background: "rgba(91,155,255,0.08)",
                        cursor: pending ? "not-allowed" : "pointer",
                      }}
                    >
                      {stageLabel(p.stage)} ▾
                    </button>
                    {menuOpen ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          marginTop: 6,
                          zIndex: 20,
                          minWidth: 160,
                          borderRadius: 12,
                          border: `1px solid ${fp.line}`,
                          background: "#141420",
                          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                          padding: 6,
                        }}
                      >
                        {STAGES.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              void run(
                                supabase.from("founder_pipeline").update({ stage: s.key }).eq("id", p.id),
                              ).then(() => setStageMenuId(null))
                            }
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              border: "none",
                              borderRadius: 8,
                              background: curStage === s.key ? "rgba(91,155,255,0.12)" : "transparent",
                              color: fp.tx,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {showDelete ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void run(supabase.from("founder_pipeline").delete().eq("id", p.id)).then(() =>
                          setSwipedId(null),
                        )
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "none",
                        background: fp.red,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Löschen
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
