"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/auth-fetch";
import { sortOrderIndexForKategorie } from "@/lib/category-sort-order";
import { compressImageFile } from "@/lib/compress-image";
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
  const [genBusy, setGenBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setDesc(item.beschreibung ?? "");
      setAllergens(item.allergens_text ?? "");
      setTags(Array.isArray(item.tags) ? [...item.tags] : []);
      setPreisStr(formatPreisEUR(item.preis));
      setKategorie(item.kategorie || "Sonstiges");
      setImageUrl(item.bild_url ?? null);
    } else {
      setName("");
      setDesc("");
      setImageUrl(null);
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

  async function handleImageUpload(file: File) {
    if (!editing) {
      onToast("Erst speichern, dann Bild hochladen");
      return;
    }
    const mime = (file.type || "").toLowerCase();
    if (!mime.startsWith("image/")) {
      onToast("Nur JPG oder PNG erlaubt");
      return;
    }
    setImageBusy(true);
    try {
      let processed: File = file;
      try {
        processed = await compressImageFile(file, { maxWidth: 1600, quality: 0.82 });
      } catch {
        processed = file;
      }
      if (processed.size > 5 * 1024 * 1024) {
        onToast("Bild zu groß — bitte unter 5MB");
        return;
      }
      const path = `menu-items/${restaurantId}/${editing.id}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("restaurant-assets")
        .upload(path, processed, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (uploadErr) {
        onToast(`Upload fehlgeschlagen: ${uploadErr.message}`);
        return;
      }
      const { data } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
      const url = data.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
      const { data: updateData, error: updateErr } = await supabase
        .from("menu_items")
        .update({ bild_url: url })
        .eq("id", editing.id)
        .select("id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order, allergens_text")
        .single();
      if (updateErr || !updateData) {
        onToast(updateErr?.message ?? "Speichern fehlgeschlagen");
        return;
      }
      setImageUrl(url);
      onSaved(updateData as MenuItem);
      onToast("✓ Bild gespeichert");
    } finally {
      setImageBusy(false);
    }
  }

  async function handleImageRemove() {
    if (!editing) return;
    setImageBusy(true);
    try {
      // Storage-Datei besteht, wird beim nächsten Upload mit upsert
      // überschrieben. Hier reicht es, die URL in der DB zu löschen.
      const { data, error } = await supabase
        .from("menu_items")
        .update({ bild_url: null })
        .eq("id", editing.id)
        .select("id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order, allergens_text")
        .single();
      if (error || !data) {
        onToast(error?.message ?? "Entfernen fehlgeschlagen");
        return;
      }
      setImageUrl(null);
      onSaved(data as MenuItem);
      onToast("✓ Bild entfernt");
    } finally {
      setImageBusy(false);
    }
  }

  function handleImageInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleImageUpload(file);
    e.target.value = "";
  }

  async function handleGenerateDescription() {
    const trimmedName = name.trim();
    if (genBusy || trimmedName.length === 0) return;
    setGenBusy(true);
    try {
      const res = await authFetch("/api/dashboard/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: trimmedName,
          kategorie: kategorie.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; description?: string; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.description) {
        onToast(json?.error ?? "Konnte keine Beschreibung generieren");
        return;
      }
      setDesc(json.description);
      onToast("✨ Beschreibung generiert");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Konnte keine Beschreibung generieren");
    } finally {
      setGenBusy(false);
    }
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

        {/* Bild-Upload — nur bei bestehenden Items (für eindeutigen Storage-Path). */}
        {!isCreate ? (
          <div className="mb-4">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
              Bild
            </label>
            {imageUrl ? (
              <div
                className="relative overflow-hidden rounded-[14px] border"
                style={{ borderColor: dash.bo, background: dash.s2 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="block h-[180px] w-full object-cover" />
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageBusy}
                    className="text-[12px] font-semibold disabled:opacity-50"
                    style={{ color: "var(--qrave-accent-soft)" }}
                  >
                    {imageBusy ? "Lädt …" : "Ändern"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImageRemove()}
                    disabled={imageBusy}
                    className="text-[12px] font-semibold disabled:opacity-50"
                    style={{ color: dash.re }}
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleImageUpload(file);
                }}
                onClick={() => imageInputRef.current?.click()}
                className="flex h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed text-center transition"
                style={{
                  borderColor: dragOver ? "var(--qrave-accent)" : "rgba(255,255,255,0.15)",
                  background: dragOver
                    ? "color-mix(in srgb, var(--qrave-accent) 8%, transparent)"
                    : "rgba(255,255,255,0.03)",
                }}
                role="button"
                aria-label="Bild hochladen"
              >
                <i
                  className="fa-solid fa-cloud-arrow-up text-[20px]"
                  style={{ color: "var(--qrave-accent-strong)" }}
                />
                <div className="text-[12px] font-semibold" style={{ color: dash.mi }}>
                  {imageBusy ? "Lädt …" : "Bild hochladen oder hierhin ziehen"}
                </div>
                <div className="text-[10px]" style={{ color: dash.mu }}>
                  JPG/PNG · automatisch komprimiert
                </div>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleImageInputChange}
            />
          </div>
        ) : null}

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
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[10px] font-medium uppercase tracking-widest" style={{ color: dash.mu }}>
            Beschreibung
          </label>
          {name.trim().length > 0 && desc.trim().length === 0 ? (
            <button
              type="button"
              disabled={genBusy}
              onClick={() => void handleGenerateDescription()}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95"
              style={{
                borderColor: genBusy ? dash.bo : "rgba(0,200,160,0.35)",
                backgroundColor: genBusy ? dash.s2 : "rgba(0,200,160,0.12)",
                color: genBusy ? dash.mu : dash.teal,
                cursor: genBusy ? "wait" : "pointer",
              }}
            >
              {genBusy ? "✨ Generiert …" : "✨ Beschreibung generieren"}
            </button>
          ) : null}
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          maxLength={200}
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
            { key: "vegan", label: "Vegan", icon: "fa-solid fa-seedling" },
            { key: "veg", label: "Vegetarisch", icon: "fa-solid fa-leaf" },
            { key: "gf", label: "Glutenfrei", icon: "fa-solid fa-wheat-awn-circle-exclamation" },
            { key: "spicy", label: "Scharf", icon: "fa-solid fa-pepper-hot" },
          ].map((chip) => {
            const active = tags.includes(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => toggleTag(chip.key)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95"
                style={
                  active
                    ? {
                        borderColor: dash.teal,
                        backgroundColor: "rgba(147,51,234,0.15)",
                        color: dash.teal,
                      }
                    : {
                        borderColor: dash.bo,
                        backgroundColor: dash.s2,
                        color: dash.mu,
                      }
                }
              >
                <i className={`${chip.icon} text-[11px]`} />
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
            <i className="fa-solid fa-trash mr-1.5" /> Löschen
          </button>
        )}
      </div>
    </div>
  );
}
