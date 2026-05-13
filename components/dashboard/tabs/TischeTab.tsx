"use client";

import { useEffect, useState } from "react";
import { Hint } from "../Hint";

type TischBereich = { name: string; count: number; geschlossen?: boolean };

type Props = {
  /** Aktueller Stand aus restaurants.tisch_bereiche. */
  initial: TischBereich[];
  onSave: (next: TischBereich[]) => Promise<void> | void;
};

export function TischeTab({ initial, onSave }: Props) {
  const [list, setList] = useState<TischBereich[]>(initial);
  const [newName, setNewName] = useState("");
  const [newCount, setNewCount] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setList(initial);
  }, [initial]);

  async function commit(next: TischBereich[]) {
    setList(next);
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const name = newName.trim();
    const c = typeof newCount === "number" ? newCount : Number.parseInt(String(newCount), 10);
    if (!name || !Number.isFinite(c) || c <= 0) return;
    const next = [...list, { name, count: Math.max(1, Math.min(999, c)) }];
    setNewName("");
    setNewCount("");
    void commit(next);
  }

  function remove(idx: number) {
    void commit(list.filter((_, i) => i !== idx));
  }

  function updateCount(idx: number, value: number) {
    void commit(list.map((b, i) => (i === idx ? { ...b, count: Math.max(1, Math.min(999, value)) } : b)));
  }

  function updateName(idx: number, value: string) {
    void commit(list.map((b, i) => (i === idx ? { ...b, name: value } : b)));
  }

  function toggleGeschlossen(idx: number) {
    void commit(
      list.map((b, i) => (i === idx ? { ...b, geschlossen: !(b.geschlossen === true) } : b)),
    );
  }

  const total = list.reduce((sum, b) => sum + (Number.isFinite(b.count) ? b.count : 0), 0);

  return (
    <div className="space-y-4">
      <header className="mb-2">
        <h2 className="qrave-font-display flex items-center gap-2 text-[22px] font-black leading-tight tracking-tight">
          Tisch-<span style={{ color: "var(--qrave-accent-strong)" }}>Bereiche</span>
          <Hint text="Lege die Bereiche deines Restaurants an (z. B. Innen, Terrasse, Bar) mit der jeweiligen Tisch-Anzahl. Wird für die Tisch-Übersicht und Statistiken genutzt." />
        </h2>
        <p className="mt-1 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          {list.length} {list.length === 1 ? "Bereich" : "Bereiche"} · {total} Tische gesamt
          {saving ? " · Speichert …" : ""}
        </p>
      </header>

      <section
        className="rounded-[16px] border p-5"
        style={{ background: "var(--qrave-dash-surface)", borderColor: "var(--qrave-dash-border)" }}
      >
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Bereiche
        </div>

        {list.length === 0 ? (
          <p
            className="rounded-[12px] border border-dashed px-4 py-6 text-center text-[13px]"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(242,242,242,0.5)" }}
          >
            Noch keine Bereiche angelegt. Füge unten den ersten hinzu (z. B. „Innen" mit 12 Tischen).
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((b, idx) => {
              const closed = b.geschlossen === true;
              return (
                <li
                  key={`${idx}`}
                  className="rounded-[12px] border px-3.5 py-2.5"
                  style={{
                    background: closed ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.03)",
                    borderColor: closed ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.06)",
                    opacity: closed ? 0.92 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <i
                      className="fa-solid fa-table-cells text-[14px]"
                      style={{
                        color: closed ? "rgba(248,113,113,0.85)" : "var(--qrave-accent-strong)",
                      }}
                    />
                    <input
                      value={b.name}
                      onChange={(e) => updateName(idx, e.target.value)}
                      className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-[13px] font-semibold outline-none focus:bg-white/[0.04]"
                      style={{
                        color: closed ? "rgba(242,242,242,0.6)" : "#f2f2f2",
                        textDecoration: closed ? "line-through" : undefined,
                      }}
                    />
                    <div
                      className="flex items-center gap-2 rounded-md border px-2 py-1"
                      style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    >
                      <button
                        type="button"
                        aria-label="Anzahl verringern"
                        onClick={() => updateCount(idx, b.count - 1)}
                        className="text-[11px]"
                        style={{ color: "rgba(242,242,242,0.6)" }}
                        disabled={b.count <= 1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={b.count}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          if (Number.isFinite(n)) updateCount(idx, n);
                        }}
                        className="w-12 bg-transparent text-center text-[13px] font-semibold outline-none"
                        style={{ color: "#f2f2f2" }}
                      />
                      <button
                        type="button"
                        aria-label="Anzahl erhöhen"
                        onClick={() => updateCount(idx, b.count + 1)}
                        className="text-[11px]"
                        style={{ color: "rgba(242,242,242,0.6)" }}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                      style={{ color: "rgba(248,113,113,0.85)" }}
                      aria-label={`Bereich „${b.name}" entfernen`}
                    >
                      <i className="fa-solid fa-xmark text-[12px]" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: closed ? "rgba(248,113,113,0.85)" : "rgba(242,242,242,0.6)" }}
                    >
                      {closed ? "Heute geschlossen — Gäste sehen einen Hinweis" : "Heute geschlossen"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGeschlossen(idx)}
                      className="relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors"
                      style={{ background: closed ? "#f87171" : "rgba(255,255,255,0.12)" }}
                      aria-label={closed ? `${b.name} wieder öffnen` : `${b.name} schließen`}
                    >
                      <span
                        className="absolute top-[2.5px] h-[15px] w-[15px] rounded-full bg-white shadow transition-all"
                        style={{ left: closed ? "calc(100% - 17.5px)" : "2.5px" }}
                      />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Bereich-Name (z. B. Terrasse)"
            className="min-w-0 flex-1 rounded-[10px] border bg-transparent px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: "var(--qrave-dash-border)", color: "#f2f2f2" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <input
            type="number"
            min={1}
            max={999}
            value={newCount}
            onChange={(e) => {
              const v = e.target.value;
              setNewCount(v === "" ? "" : Number.parseInt(v, 10));
            }}
            placeholder="Tische"
            className="w-full rounded-[10px] border bg-transparent px-3 py-2 text-[13px] outline-none sm:w-[90px]"
            style={{ borderColor: "var(--qrave-dash-border)", color: "#f2f2f2" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!newName.trim() || !newCount || (typeof newCount === "number" && newCount <= 0)}
            className="rounded-[10px] px-4 py-2 text-[13px] font-bold transition disabled:opacity-50"
            style={{
              background: "var(--qrave-accent-gradient)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
            }}
          >
            + Hinzufügen
          </button>
        </div>
      </section>
    </div>
  );
}
