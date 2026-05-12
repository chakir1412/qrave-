"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { sortOrderIndexForKategorie } from "@/lib/category-sort-order";
import { formatPreisEUR } from "../utils";
import { dash, dashPrimaryButtonStyle } from "../constants";

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
  const [allergens, setAllergens] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preisStr, setPreisStr] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setDesc(item.beschreibung ?? "");
      setAllergens(item.allergens_text ?? "");
      setTags(Array.isArray(item.tags) ? [...item.tags] : []);
      setPreisStr(formatPreisEUR(item.preis));
      setKategorie(item.kategorie || "Sonstiges");
    } else {
      setName("");
      setDesc("");
      setAllergens("");
      setTags([]);
      setPreisStr("0");
      setKategorie(defaultCategory?.trim() || "Sonstiges");
    }
  }, [item, open, defaultCategory]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

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
    const newName = name.trim();
    const newDesc = desc.trim() || null;
    const payload: Record<string, unknown> = {
      name: newName,
      beschreibung: newDesc,
      allergens_text: allergens.trim() || null,
      tags,
      preis: p,
      kategorie: kat,
      sort_order: sortOrderIndexForKategorie(kat),
    };
    // Mehrsprachigkeit: Wenn name oder beschreibung im Edit geändert wurden,
    // werden die entsprechenden Übersetzungs-Spalten auf NULL gesetzt, damit
    // sie beim nächsten "Speisekarte übersetzen"-Trigger neu generiert werden.
    if (editing) {
      const nameChanged = newName !== (editing.name ?? "");
      const descChanged = (newDesc ?? "") !== (editing.beschreibung ?? "");
      const LOCALES = ["en", "tr", "ar", "ru", "it", "fr"] as const;
      for (const l of LOCALES) {
        if (nameChanged) payload[`name_${l}`] = null;
        if (descChanged) payload[`beschreibung_${l}`] = null;
      }
    }
    const query = isCreate
      ? supabase.from("menu_items").insert({ ...payload, restaurant_id: restaurantId, aktiv: true })
      : supabase.from("menu_items").update(payload).eq("id", editing.id);
    const { data, error } = await query
      .select(
        "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order, allergens_text",
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
        className="relative z-10 max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[24px] border-t px-5 pb-10 pt-4 md:max-w-[860px]"
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
          Allergene & Zutaten
        </label>
        <textarea
          value={allergens}
          onChange={(e) => setAllergens(e.target.value)}
          rows={2}
          placeholder="z. B. enthält Gluten, Milch, Sellerie"
          className="mb-3 w-full resize-none rounded-[11px] border px-3.5 py-3 text-sm outline-none"
          style={{
            backgroundColor: dash.s2,
            borderColor: dash.bo,
            color: dash.tx,
          }}
        />
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
          Diät / Eigenschaften
        </label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            { key: "vegan", label: "🌱 Vegan" },
            { key: "veg", label: "🌿 Vegetarisch" },
            { key: "gf", label: "🚫 Glutenfrei" },
            { key: "spicy", label: "🌶 Scharf" },
          ].map((chip) => {
            const active = tags.includes(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => toggleTag(chip.key)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95"
                style={
                  active
                    ? {
                        borderColor: dash.teal,
                        backgroundColor: "rgba(0,200,160,0.15)",
                        color: dash.teal,
                      }
                    : {
                        borderColor: dash.bo,
                        backgroundColor: dash.s2,
                        color: dash.mu,
                      }
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>
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
          className="w-full rounded-[10px] py-3.5 text-[15px] font-bold"
          style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
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
              borderColor: "rgba(255,75,110,0.28)",
              color: dash.re,
              backgroundColor: "rgba(255,75,110,0.12)",
            }}
          >
            🗑️ Löschen
          </button>
        )}
      </div>
    </div>
  );
}
