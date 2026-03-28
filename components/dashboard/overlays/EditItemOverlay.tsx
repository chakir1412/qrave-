"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { sortOrderIndexForKategorie } from "@/lib/category-sort-order";
import { formatPreisEUR } from "../utils";
import { dash } from "../constants";

type Props = {
  item: MenuItem | null;
  restaurantId: string;
  defaultCategory?: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: MenuItem) => void;
  onCreated: (created: MenuItem) => void;
  onDeleted: (id: string) => void;
  onToast: (msg: string) => void;
};

function parsePreisInput(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace("€", "").replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function EditItemOverlay({
  item,
  restaurantId,
  defaultCategory,
  open,
  onClose,
  onSaved,
  onCreated,
  onDeleted,
  onToast,
}: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [preisStr, setPreisStr] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setDesc(item.beschreibung ?? "");
      setPreisStr(formatPreisEUR(item.preis));
      setKategorie(item.kategorie || "Sonstiges");
    } else {
      setName("");
      setDesc("");
      setPreisStr("0");
      setKategorie(defaultCategory?.trim() || "Sonstiges");
    }
  }, [item, open, defaultCategory]);

  if (!open) return null;
  const editing = item;
  const isCreate = !editing;

  async function handleSave() {
    const p = parsePreisInput(preisStr);
    if (!name.trim() || p === null) {
      onToast("Name und gültiger Preis nötig");
      return;
    }
    if (!kategorie.trim()) {
      onToast("Kategorie ist erforderlich");
      return;
    }
    setBusy(true);
    const kat = kategorie.trim();
    const payload = {
      name: name.trim(),
      beschreibung: desc.trim() || null,
      preis: p,
      kategorie: kat,
      sort_order: sortOrderIndexForKategorie(kat),
    };
    const query = isCreate
      ? supabase.from("menu_items").insert({ ...payload, restaurant_id: restaurantId, aktiv: true })
      : supabase.from("menu_items").update(payload).eq("id", editing.id);
    const { data, error } = await query
      .select(
        "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order",
      )
      .single();

    setBusy(false);
    if (error || !data) {
      onToast(error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    if (isCreate) {
      onCreated(data as MenuItem);
      onToast("✓ Gericht erstellt");
    } else {
      onSaved(data as MenuItem);
      onToast("✓ Gespeichert");
    }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.from("menu_items").delete().eq("id", editing.id);
    setBusy(false);
    if (error) {
      onToast(error.message ?? "Löschen fehlgeschlagen");
      return;
    }
    onDeleted(editing.id);
    onToast("🗑️ Gericht gelöscht");
    onClose();
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
        <h2 className="mb-4 text-xl font-extrabold tracking-tight">
          {isCreate ? "Neues Gericht" : "Gericht bearbeiten"}
        </h2>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
          style={{
            backgroundColor: dash.s2,
            borderColor: dash.bo,
            color: dash.tx,
          }}
        />
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
          Beschreibung
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          className="mb-3 w-full resize-none rounded-[11px] border px-3.5 py-3 text-sm outline-none"
          style={{
            backgroundColor: dash.s2,
            borderColor: dash.bo,
            color: dash.tx,
          }}
        />
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
          Kategorie
        </label>
        <input
          value={kategorie}
          onChange={(e) => setKategorie(e.target.value)}
          className="mb-3 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
          style={{
            backgroundColor: dash.s2,
            borderColor: dash.bo,
            color: dash.tx,
          }}
        />
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
          Preis (EUR)
        </label>
        <input
          value={preisStr}
          onChange={(e) => setPreisStr(e.target.value)}
          className="mb-5 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
          style={{
            backgroundColor: dash.s2,
            borderColor: dash.bo,
            color: dash.tx,
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="w-full rounded-[13px] py-3.5 text-[15px] font-bold text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
            boxShadow: "0 6px 20px rgba(232,80,2,0.3)",
          }}
        >
          {busy ? "Speichert …" : "Speichern"}
        </button>
        {!isCreate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDelete()}
            className="mt-2 w-full rounded-[11px] border py-3 text-sm font-bold"
            style={{
              borderColor: "rgba(224,92,92,0.25)",
              color: dash.re,
              backgroundColor: "rgba(224,92,92,0.08)",
            }}
          >
            🗑️ Löschen
          </button>
        )}
      </div>
    </div>
  );
}
