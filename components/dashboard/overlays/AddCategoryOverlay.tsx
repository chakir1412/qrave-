"use client";

import { useState } from "react";
import { dash } from "../constants";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
};

export function AddCategoryOverlay({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    const t = name.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAdd(t);
      setName("");
      onClose();
    } catch {
      /* Fehler: Toast kommt vom Parent */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] border-t px-5 pb-10 pt-4"
        style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1 w-9 rounded-full"
          style={{ backgroundColor: dash.s3 }}
        />
        <h2 className="mb-2 text-xl font-extrabold tracking-tight">Neue Kategorie</h2>
        <p className="mb-4 text-xs" style={{ color: dash.mu }}>
          Es wird ein Platzhalter-Gericht angelegt, damit die Kategorie in der Liste erscheint.
          Du kannst es danach bearbeiten.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. 🥗 Vorspeisen"
          className="mb-4 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none transition focus:border-[rgba(232,80,2,0.28)]"
          style={{
            backgroundColor: dash.s2,
            borderColor: dash.bo,
            color: dash.tx,
          }}
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void handleSubmit()}
          className="w-full rounded-[13px] py-3.5 text-[15px] font-bold text-white shadow-lg disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
            boxShadow: "0 6px 20px rgba(232,80,2,0.3)",
          }}
        >
          {busy ? "Wird angelegt …" : "Kategorie anlegen"}
        </button>
      </div>
    </div>
  );
}
