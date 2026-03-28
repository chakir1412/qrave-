"use client";

import { useMemo, useState } from "react";
import type { FounderPipelineRow, FounderWerbepartnerRow } from "@/lib/founder-types";
import { FOUNDER_DESKTOP_MEDIA, useMediaQuery } from "@/hooks/useMediaQuery";
import { founderDash, founderGlassCard } from "../constants";

type Sub = "pipeline" | "werbepartner";

type Props = {
  pipeline: FounderPipelineRow[];
  werbepartner: FounderWerbepartnerRow[];
  busy: boolean;
  onAddPipeline: (row: {
    name: string;
    contact: string;
    phone: string;
    area: string;
    heat: string;
    stage: string;
  }) => Promise<void>;
  onAddWerbepartner: (row: {
    name: string;
    company: string;
    contact: string;
    phone: string;
    mrr_monthly: number;
  }) => Promise<void>;
};

const KANBAN_STAGES = [
  { key: "contact", label: "Contact" },
  { key: "trial", label: "Trial" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

function normalizeStage(stage: string | null | undefined): string {
  const s = (stage ?? "contact").toLowerCase();
  if (KANBAN_STAGES.some((x) => x.key === s)) return s;
  return "contact";
}

export function KontakteTab({
  pipeline,
  werbepartner,
  busy,
  onAddPipeline,
  onAddWerbepartner,
}: Props) {
  const isDesktop = useMediaQuery(FOUNDER_DESKTOP_MEDIA);
  const [sub, setSub] = useState<Sub>("pipeline");
  const [pName, setPName] = useState("");
  const [pContact, setPContact] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pArea, setPArea] = useState("");
  const [pHeat, setPHeat] = useState("warm");
  const [pStage, setPStage] = useState("contact");

  const [wName, setWName] = useState("");
  const [wCompany, setWCompany] = useState("");
  const [wContact, setWContact] = useState("");
  const [wPhone, setWPhone] = useState("");
  const [wMrr, setWMrr] = useState("");

  const pipelineByStage = useMemo(() => {
    const m = new Map<string, FounderPipelineRow[]>();
    for (const s of KANBAN_STAGES) {
      m.set(s.key, []);
    }
    for (const p of pipeline) {
      const k = normalizeStage(p.stage);
      const list = m.get(k) ?? m.get("contact")!;
      list.push(p);
    }
    return m;
  }, [pipeline]);

  const subToggle = (
    <div className="flex gap-2 p-1" style={{ ...founderGlassCard, borderRadius: 16 }}>
      {(
        [
          { id: "pipeline" as const, label: "Pipeline" },
          { id: "werbepartner" as const, label: "Werbepartner" },
        ] as const
      ).map((t) => {
        const active = sub === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className="flex-1 rounded-xl py-2.5 text-xs font-extrabold transition"
            style={{
              backgroundColor: active ? founderDash.ord : "transparent",
              color: active ? founderDash.or : founderDash.mu,
              border: active ? `1px solid ${founderDash.orm}` : "1px solid transparent",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const newPipelineForm = (
    <section className="p-4" style={founderGlassCard}>
      <h3 className="text-sm font-extrabold" style={{ color: founderDash.or }}>
        Neuer Kontakt
      </h3>
      <input
        value={pName}
        onChange={(e) => setPName(e.target.value)}
        placeholder="Name"
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
      />
      <input
        value={pContact}
        onChange={(e) => setPContact(e.target.value)}
        placeholder="Kontakt (E-Mail / Person)"
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
      />
      <input
        value={pPhone}
        onChange={(e) => setPPhone(e.target.value)}
        placeholder="Telefon"
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
      />
      <input
        value={pArea}
        onChange={(e) => setPArea(e.target.value)}
        placeholder="Area / Stadt"
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select
          value={pHeat}
          onChange={(e) => setPHeat(e.target.value)}
          className="rounded-xl border px-2 py-2 text-sm outline-none"
          style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
        >
          <option value="cold">kalt</option>
          <option value="warm">warm</option>
          <option value="hot">hot</option>
        </select>
        <select
          value={pStage}
          onChange={(e) => setPStage(e.target.value)}
          className="rounded-xl border px-2 py-2 text-sm outline-none"
          style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
        >
          <option value="contact">contact</option>
          <option value="trial">trial</option>
          <option value="won">won</option>
          <option value="lost">lost</option>
        </select>
      </div>
      <button
        type="button"
        disabled={busy || !pName.trim()}
        onClick={() =>
          void onAddPipeline({
            name: pName.trim(),
            contact: pContact.trim(),
            phone: pPhone.trim(),
            area: pArea.trim(),
            heat: pHeat,
            stage: pStage,
          }).then(() => {
            setPName("");
            setPContact("");
            setPPhone("");
            setPArea("");
          })
        }
        className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${founderDash.or}, ${founderDash.or2})` }}
      >
        Hinzufügen
      </button>
    </section>
  );

  function pipelineCardInner(p: FounderPipelineRow) {
    return (
      <>
        <div className="font-bold" style={{ color: founderDash.tx }}>
          {p.name}
        </div>
        <div className="mt-1 text-xs" style={{ color: founderDash.mu }}>
          {p.area ?? "—"} · {p.contact ?? "—"} · {p.phone ?? "—"}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
          <span className="rounded-md border px-2 py-0.5" style={{ borderColor: founderDash.orm, color: founderDash.or }}>
            {p.heat ?? "warm"}
          </span>
          <span className="rounded-md border px-2 py-0.5" style={{ borderColor: founderDash.bo, color: founderDash.mu }}>
            {p.stage ?? "contact"}
          </span>
        </div>
        {p.note ? (
          <p className="mt-2 text-xs" style={{ color: founderDash.mi }}>
            {p.note}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className={isDesktop ? "flex flex-col gap-5 pb-4" : "flex flex-col gap-4 pb-28"}>
      {subToggle}

      {sub === "pipeline" ? (
        <>
          {isDesktop ? (
            <div className="max-w-xl">{newPipelineForm}</div>
          ) : (
            newPipelineForm
          )}

          {isDesktop ? (
            <div className="grid gap-3 lg:grid-cols-4">
              {KANBAN_STAGES.map((col) => (
                <div key={col.key} className="flex min-h-[200px] flex-col gap-2 rounded-[20px] p-3" style={founderGlassCard}>
                  <div
                    className="mb-1 text-center text-[11px] font-black uppercase tracking-wider"
                    style={{ color: founderDash.ye }}
                  >
                    {col.label}
                  </div>
                  <div className="flex max-h-[min(60vh,520px)] flex-col gap-2 overflow-y-auto pr-0.5">
                    {(pipelineByStage.get(col.key) ?? []).map((p) => (
                      <div
                        key={p.id}
                        className="p-4"
                        style={{
                          ...founderGlassCard,
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {pipelineCardInner(p)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pipeline.map((p) => (
                <div
                  key={p.id}
                  className="p-4"
                  style={{
                    ...founderGlassCard,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  {pipelineCardInner(p)}
                </div>
              ))}
              {pipeline.length === 0 ? (
                <p className="text-center text-xs" style={{ color: founderDash.mu }}>
                  Noch keine Pipeline-Einträge.
                </p>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <>
          <section className="p-4" style={founderGlassCard}>
            <h3 className="text-sm font-extrabold" style={{ color: founderDash.or }}>
              Neuer Werbepartner
            </h3>
            <p className="mt-1 text-xs" style={{ color: founderDash.mu }}>
              Tabelle founder_werbepartner (MRR monatlich)
            </p>
            <input
              value={wName}
              onChange={(e) => setWName(e.target.value)}
              placeholder="Name"
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
            />
            <input
              value={wCompany}
              onChange={(e) => setWCompany(e.target.value)}
              placeholder="Firma"
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
            />
            <input
              value={wContact}
              onChange={(e) => setWContact(e.target.value)}
              placeholder="Kontakt"
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
            />
            <input
              value={wPhone}
              onChange={(e) => setWPhone(e.target.value)}
              placeholder="Telefon"
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
            />
            <input
              value={wMrr}
              onChange={(e) => setWMrr(e.target.value)}
              placeholder="MRR (EUR), z. B. 199.00"
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
            />
            <button
              type="button"
              disabled={busy || !wName.trim()}
              onClick={() =>
                void onAddWerbepartner({
                  name: wName.trim(),
                  company: wCompany.trim(),
                  contact: wContact.trim(),
                  phone: wPhone.trim(),
                  mrr_monthly: Number.parseFloat(wMrr.replace(",", ".")) || 0,
                }).then(() => {
                  setWName("");
                  setWCompany("");
                  setWContact("");
                  setWPhone("");
                  setWMrr("");
                })
              }
              className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${founderDash.or}, ${founderDash.or2})` }}
            >
              Hinzufügen
            </button>
          </section>

          <div
            className={
              isDesktop ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"
            }
          >
            {werbepartner.map((w) => (
              <div key={w.id} className="p-4" style={founderGlassCard}>
                <div className="font-bold" style={{ color: founderDash.tx }}>
                  {w.name}
                </div>
                <div className="mt-1 text-xs" style={{ color: founderDash.mu }}>
                  {w.company ?? "—"} · {w.contact ?? "—"}
                </div>
                <div className="mt-2 text-sm font-bold tabular-nums" style={{ color: founderDash.or }}>
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
                    Number(w.mrr_monthly) || 0,
                  )}
                  <span className="ml-2 text-[10px] font-semibold uppercase" style={{ color: founderDash.mu }}>
                    / Monat
                  </span>
                </div>
              </div>
            ))}
            {werbepartner.length === 0 ? (
              <p className="text-center text-xs sm:col-span-full" style={{ color: founderDash.mu }}>
                Noch keine Werbepartner.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
