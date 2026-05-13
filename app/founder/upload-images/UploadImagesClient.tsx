"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { compressImageFile } from "@/lib/compress-image";

export type UploadImagesItem = {
  id: string;
  name: string;
  kategorie: string;
  preis: number;
  bild_url: string | null;
  restaurant_id: string;
};

type Item = UploadImagesItem;
type RowStatus = "idle" | "uploading" | "done" | "error";

export function UploadImagesClient({ initialItems }: { initialItems: UploadImagesItem[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [statusById, setStatusById] = useState<Record<string, { status: RowStatus; error?: string }>>({});

  async function handleUpload(itemId: string, file: File) {
    if (!file.type.toLowerCase().startsWith("image/")) {
      setStatusById((s) => ({ ...s, [itemId]: { status: "error", error: "Nur JPG/PNG" } }));
      return;
    }
    setStatusById((s) => ({ ...s, [itemId]: { status: "uploading" } }));
    try {
      let processed: File = file;
      try {
        processed = await compressImageFile(file, { maxWidth: 1600, quality: 0.82 });
      } catch {
        processed = file;
      }
      if (processed.size > 5 * 1024 * 1024) {
        setStatusById((s) => ({ ...s, [itemId]: { status: "error", error: "> 5MB" } }));
        return;
      }
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const path = `menu-items/${item.restaurant_id}/${itemId}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("restaurant-assets")
        .upload(path, processed, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (uploadErr) {
        setStatusById((s) => ({ ...s, [itemId]: { status: "error", error: uploadErr.message } }));
        return;
      }
      const { data } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
      const url = data.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
      const { error: updateErr } = await supabase
        .from("menu_items")
        .update({ bild_url: url })
        .eq("id", itemId);
      if (updateErr) {
        setStatusById((s) => ({ ...s, [itemId]: { status: "error", error: updateErr.message } }));
        return;
      }
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, bild_url: url } : it)));
      setStatusById((s) => ({ ...s, [itemId]: { status: "done" } }));
    } catch (e) {
      setStatusById((s) => ({
        ...s,
        [itemId]: { status: "error", error: e instanceof Error ? e.message : "Fehler" },
      }));
    }
  }

  async function handleRemove(itemId: string) {
    setStatusById((s) => ({ ...s, [itemId]: { status: "uploading" } }));
    const { error } = await supabase
      .from("menu_items")
      .update({ bild_url: null })
      .eq("id", itemId);
    if (error) {
      setStatusById((s) => ({ ...s, [itemId]: { status: "error", error: error.message } }));
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, bild_url: null } : it)));
    setStatusById((s) => ({ ...s, [itemId]: { status: "done" } }));
  }

  const withImage = items.filter((i) => i.bild_url).length;

  return (
    <div className="min-h-dvh px-5 py-8 md:px-10 md:py-12" style={{ background: "#06040e", color: "#f2f2f2" }}>
      <div className="mx-auto w-full max-w-[960px]">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="qrave-font-display text-[24px] font-black tracking-tight">
              Bild-Upload · <span style={{ color: "var(--qrave-accent-strong)" }}>Frankfurter Wirtshaus</span>
            </h1>
            <p className="mt-1 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              {withImage} von {items.length} Items haben ein Bild · Komprimierung läuft automatisch (1600px / JPEG 82)
            </p>
          </div>
          <Link
            href="/founder"
            className="rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(242,242,242,0.6)" }}
          >
            ← Founder
          </Link>
        </header>

        <div className="space-y-2">
          {items.map((it) => (
            <BulkRow
              key={it.id}
              item={it}
              status={statusById[it.id]?.status ?? "idle"}
              errorMsg={statusById[it.id]?.error}
              onUpload={(file) => void handleUpload(it.id, file)}
              onRemove={() => void handleRemove(it.id)}
            />
          ))}
          {items.length === 0 ? (
            <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Keine Items im Frankfurter Wirtshaus gefunden.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BulkRow({
  item,
  status,
  errorMsg,
  onUpload,
  onRemove,
}: {
  item: Item;
  status: RowStatus;
  errorMsg?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = "";
  }
  const busy = status === "uploading";

  return (
    <div
      className="flex items-center gap-4 rounded-[14px] border px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: status === "error" ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}
      >
        {item.bild_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.bild_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <i className="fa-solid fa-image text-white/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{item.name}</div>
        <div className="truncate text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          {item.kategorie} · {item.preis.toFixed(2)} €
        </div>
        {errorMsg ? (
          <div className="mt-1 text-[11px]" style={{ color: "#f87171" }}>
            {errorMsg}
          </div>
        ) : status === "done" ? (
          <div className="mt-1 text-[11px]" style={{ color: "#4ade80" }}>
            ✓ Gespeichert
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
          style={{
            borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
            background: "color-mix(in srgb, var(--qrave-accent) 12%, transparent)",
            color: "var(--qrave-accent-soft)",
          }}
        >
          {busy ? "Lädt …" : item.bild_url ? "Ändern" : "Hochladen"}
        </button>
        {item.bild_url ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
            style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}
          >
            Entfernen
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
