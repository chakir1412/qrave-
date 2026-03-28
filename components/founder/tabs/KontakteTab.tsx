"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { FounderPipelineRow, FounderWerbepartnerRow } from "@/lib/founder-types";
import { fp } from "../founder-palette";

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

export function KontakteTab({ pipeline, werbepartner, busy, onAddPipeline, onAddWerbepartner }: Props) {
  void werbepartner;
  void onAddWerbepartner;

  const [pName, setPName] = useState("");
  const [pContact, setPContact] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pArea, setPArea] = useState("");
  const [pHeat, setPHeat] = useState("warm");
  const [pStage, setPStage] = useState("contact");

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div style={{ ...cardShell, padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: fp.or }}>Neuer Pipeline-Kontakt</h3>
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Name
            <input value={pName} onChange={(e) => setPName(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Kontakt
            <input value={pContact} onChange={(e) => setPContact(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Telefon
            <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Bezirk / Area
            <input value={pArea} onChange={(e) => setPArea(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Heat
            <select
              value={pHeat}
              onChange={(e) => setPHeat(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Kalt</option>
            </select>
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Stage
            <select
              value={pStage}
              onChange={(e) => setPStage(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="contact">Contact</option>
              <option value="trial">Trial</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
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
              setPHeat("warm");
              setPStage("contact");
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
            cursor: busy || !pName.trim() ? "not-allowed" : "pointer",
            opacity: busy || !pName.trim() ? 0.5 : 1,
            background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
            boxShadow: `0 8px 24px ${fp.or}44`,
          }}
        >
          {busy ? "Speichert …" : "Zur Pipeline hinzufügen"}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {pipeline.length === 0 ? (
          <p style={{ color: fp.mu, fontSize: 14 }}>Noch keine Einträge in der Pipeline.</p>
        ) : null}
        {pipeline.map((p) => {
          const borderC = heatBorderColor(p.heat);
          return (
            <div
              key={p.id}
              style={{
                ...cardShell,
                padding: "18px 20px 18px 16px",
                borderLeft: `4px solid ${borderC}`,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: fp.tx }}>{p.name}</div>
                  <div className="mt-1 flex flex-wrap gap-3" style={{ fontSize: 12, color: fp.mu }}>
                    {p.area ? <span>{p.area}</span> : null}
                    {p.contact ? <span>{p.contact}</span> : null}
                    {p.phone ? <span>{p.phone}</span> : null}
                  </div>
                  {p.note ? (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: fp.mi, lineHeight: 1.45 }}>{p.note}</p>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "4px 10px",
                      borderRadius: 9999,
                      background: "rgba(255,255,255,0.06)",
                      color: borderC,
                      border: `1px solid ${borderC}55`,
                    }}
                  >
                    {heatLabel(p.heat)}
                  </span>
                  {p.stage ? (
                    <div style={{ marginTop: 8, fontSize: 11, color: fp.mu, fontWeight: 600 }}>Stage: {p.stage}</div>
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
