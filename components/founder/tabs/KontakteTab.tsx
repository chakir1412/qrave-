"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  isMobile: boolean;
  onRefresh: () => Promise<void>;
};

type Heat = "Hot" | "Warm" | "Kalt";
type Stage = "Kontaktiert" | "Demo gezeigt" | "Follow-up" | "Gewonnen" | "Verloren";

type PipelineItem = {
  id: string;
  name: string;
  inhaber: string | null;
  bezirk: string | null;
  telefon: string | null;
  waerme: Heat | null;
  stage: Stage | null;
  next_action: string | null;
  notizen: string | null;
  created_at: string;
};

type FormState = {
  name: string;
  inhaber: string;
  bezirk: string;
  telefon: string;
  waerme: Heat;
  stage: Stage;
  next_action: string;
  notizen: string;
};

const STAGES: Stage[] = ["Kontaktiert", "Demo gezeigt", "Follow-up", "Gewonnen", "Verloren"];
const HEATS: Heat[] = ["Hot", "Warm", "Kalt"];

function stageColor(stage: Stage | null): string {
  const s = (stage ?? "Kontaktiert").toLowerCase();
  if (s.includes("demo")) return "#ff5c1a";
  if (s.includes("follow")) return "#5b9bff";
  if (s.includes("gew")) return "#00c8a0";
  if (s.includes("verl")) return "#ff4b6e";
  return "#ffd426";
}

function heatColor(heat: Heat | null): string {
  const h = (heat ?? "Warm").toLowerCase();
  if (h.includes("hot")) return "#ff4b6e";
  if (h.includes("kalt")) return "#5b9bff";
  return "#ffd426";
}

function emptyForm(): FormState {
  return {
    name: "",
    inhaber: "",
    bezirk: "",
    telefon: "",
    waerme: "Warm",
    stage: "Kontaktiert",
    next_action: "",
    notizen: "",
  };
}

export function KontakteTab({ isMobile, onRefresh }: Props) {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  async function loadItems(): Promise<void> {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline")
      .select("id,name,inhaber,bezirk,telefon,waerme,stage,next_action,notizen,created_at")
      .order("created_at", { ascending: false });
    if (!error) setItems((data ?? []) as PipelineItem[]);
    setLoading(false);
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void loadItems();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const title = editingId ? "Kontakt bearbeiten" : "Neuen Pipeline-Kontakt";

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(item: PipelineItem): void {
    setEditingId(item.id);
    setForm({
      name: item.name,
      inhaber: item.inhaber ?? "",
      bezirk: item.bezirk ?? "",
      telefon: item.telefon ?? "",
      waerme: item.waerme ?? "Warm",
      stage: item.stage ?? "Kontaktiert",
      next_action: item.next_action ?? "",
      notizen: item.notizen ?? "",
    });
    setModalOpen(true);
  }

  async function save(): Promise<void> {
    if (!form.name.trim()) return;
    setSaveError(null);
    const payload = {
      name: form.name.trim(),
      inhaber: form.inhaber.trim() || null,
      bezirk: form.bezirk.trim() || null,
      telefon: form.telefon.trim() || null,
      waerme: form.waerme,
      stage: form.stage,
      next_action: form.next_action.trim() || null,
      notizen: form.notizen.trim() || null,
      status: form.stage,
    };
    if (editingId) {
      const { data, error } = await supabase
        .from("pipeline")
        .update(payload)
        .eq("id", editingId)
        .select("id,name,inhaber,bezirk,telefon,waerme,stage,next_action,notizen,created_at")
        .single();
      if (error) {
        console.error("Pipeline UPDATE Fehler:", error);
        setSaveError(`Fehler beim Speichern: ${error.message}`);
        return;
      }
      setItems((prev) =>
        prev.map((p) =>
          p.id === editingId ? ({ ...(data as PipelineItem) } as PipelineItem) : p,
        ),
      );
    } else {
      const { data, error } = await supabase
        .from("pipeline")
        .insert(payload)
        .select("id,name,inhaber,bezirk,telefon,waerme,stage,next_action,notizen,created_at")
        .single();
      if (error) {
        console.error("Pipeline INSERT Fehler:", error);
        setSaveError(`Fehler beim Speichern: ${error.message}`);
        return;
      }
      setItems((prev) => [{ ...(data as PipelineItem) } as PipelineItem, ...prev]);
    }
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    void onRefresh();
  }

  const sorted = useMemo(() => items, [items]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pipeline</h2>
        <button
          type="button"
          onClick={openCreate}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,92,26,0.4)",
            background: "rgba(255,92,26,0.12)",
            color: "#ff5c1a",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          + Kontakt hinzufügen
        </button>
      </div>

      {loading && sorted.length === 0 ? (
        <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Lade Pipeline...</p>
      ) : null}

      {sorted.length === 0 ? (
        <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          Noch keine Pipeline-Einträge.
        </p>
      ) : (
        sorted.map((p) => {
          const sColor = stageColor(p.stage);
          const hColor = heatColor(p.waerme);
          return (
            <article
              key={p.id}
              className="founder-card"
              style={{
                padding: isMobile ? 12 : 14,
                borderLeft: `3px solid ${sColor}`,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{p.name}</h3>
                  <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.58)", fontSize: 11 }}>
                    {p.next_action ?? "Keine nächste Aktion"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  style={{
                    border: "none",
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.85)",
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                  aria-label="Bearbeiten"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "3px 8px",
                    color: sColor,
                    background: `${sColor}22`,
                    border: `1px solid ${sColor}55`,
                  }}
                >
                  {p.stage ?? "Kontaktiert"}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "3px 8px",
                    color: hColor,
                    background: `${hColor}22`,
                    border: `1px solid ${hColor}55`,
                  }}
                >
                  {p.waerme ?? "Warm"}
                </span>
              </div>
            </article>
          );
        })
      )}

      {modalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 410,
            background: "rgba(0,0,0,0.62)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
        >
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            style={{ position: "absolute", inset: 0, border: "none", background: "transparent", cursor: "default" }}
            aria-label="Schließen"
          />
          <div
            className="founder-card"
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "92vh",
              overflow: "auto",
              position: "relative",
              zIndex: 1,
              borderRadius: isMobile ? "20px 20px 0 0" : 14,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            {saveError ? (
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#ff4b6e" }}>{saveError}</p>
            ) : null}

            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 10 }}>
              Name*
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 10 }}>
              Inhaber / Ansprechpartner
              <input value={form.inhaber} onChange={(e) => setForm((f) => ({ ...f, inhaber: e.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 10 }}>
              Bezirk / Straße
              <input value={form.bezirk} onChange={(e) => setForm((f) => ({ ...f, bezirk: e.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 10 }}>
              Telefon
              <input value={form.telefon} onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))} style={fieldStyle} />
            </label>

            <p style={{ margin: "12px 0 6px", fontSize: 11, color: "rgba(255,255,255,0.58)" }}>Wärme</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {HEATS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, waerme: h }))}
                  style={chipStyle(form.waerme === h, heatColor(h))}
                >
                  {h}
                </button>
              ))}
            </div>

            <p style={{ margin: "12px 0 6px", fontSize: 11, color: "rgba(255,255,255,0.58)" }}>Stage</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, stage: s }))}
                  style={chipStyle(form.stage === s, stageColor(s))}
                >
                  {s}
                </button>
              ))}
            </div>

            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 10 }}>
              Nächste Aktion
              <input
                value={form.next_action}
                onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
                placeholder="Di 14:30 Uhr vorbeigehen"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 10 }}>
              Notizen
              <textarea
                value={form.notizen}
                onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
                rows={4}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 8 }}>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => void removeEditing()}
                  style={{
                    border: "none",
                    background: "rgba(255,75,110,0.16)",
                    color: "#ff4b6e",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Löschen
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => void save()}
                style={{
                  border: "none",
                  background: "linear-gradient(135deg,#ff5c1a,#ff8c4a)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  async function removeEditing(): Promise<void> {
    if (!editingId) return;
    if (!window.confirm("Wirklich löschen?")) return;
    const currentId = editingId;
    const { error } = await supabase.from("pipeline").delete().eq("id", currentId);
    if (error) {
      console.error("Pipeline DELETE Fehler:", error);
      setSaveError(`Fehler beim Löschen: ${error.message}`);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== currentId));
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    void onRefresh();
  }
}

const fieldStyle: CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.2)",
  color: "#fff",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

function chipStyle(active: boolean, color: string): CSSProperties {
  return {
    border: `1px solid ${active ? color : "rgba(255,255,255,0.14)"}`,
    background: active ? `${color}22` : "transparent",
    color: active ? color : "rgba(255,255,255,0.75)",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  };
}

