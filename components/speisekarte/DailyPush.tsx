"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuItem, DailyPush } from "@/lib/supabase";
import { emojiGradient } from "@/lib/emojiGradient";

const JUST_ADDED_DURATION_MS = 1500;

/** Erstellt ein MenuItem-kompatibles Objekt aus daily_push für die Merkliste (preis 0). */
function dailyPushToMenuItem(dailyPush: DailyPush): MenuItem {
  return {
    id: dailyPush.id,
    restaurant_id: dailyPush.restaurant_id,
    name: dailyPush.item_name,
    beschreibung: dailyPush.item_desc ?? null,
    preis: 0,
    kategorie: "Empfehlung",
    bild_url: null,
    aktiv: true,
    tags: null,
    emoji: dailyPush.item_emoji ?? null,
  };
}

type DailyPushBannerProps = {
  dailyPush: DailyPush;
  onOpenPopup: () => void;
};

export function DailyPushBanner({ dailyPush, onOpenPopup }: DailyPushBannerProps) {
  return (
    <button
      type="button"
      onClick={onOpenPopup}
      className="w-full mb-6 flex items-center gap-3 p-4 rounded-2xl border border-[rgba(184,150,106,0.25)] text-left transition-colors hover:border-[#b8966a]"
      style={{ background: "linear-gradient(135deg, rgba(184,150,106,0.18), rgba(15,13,10,0.95))" }}
    >
      <span className="text-[2.2rem]">{dailyPush.item_emoji || "⭐"}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[0.58rem] uppercase tracking-widest font-semibold mb-0.5" style={{ color: "#C8894E" }}>
          Chef empfiehlt heute
        </div>
        <div className="font-serif text-[1.15rem] font-normal" style={{ color: "#F0EBE3" }}>
          {dailyPush.item_name}
        </div>
        {dailyPush.item_desc && (
          <div className="text-[0.7rem] mt-0.5" style={{ color: "#F0EBE3" }}>
            {dailyPush.item_desc}
          </div>
        )}
      </div>
    </button>
  );
}

type DailyPushPopupTheme = "light" | "bar-soleil";

type DailyPushPopupProps = {
  dailyPush: DailyPush;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem, qty?: number) => void;
  theme?: DailyPushPopupTheme;
};

const barSoleilPopup = {
  bg: "#0F0D0A",
  surface: "#1C1914",
  text: "#F0EBE3",
  muted: "#8A7E70",
  copper: "#C8894E",
  copper2: "#E8A96E",
  border: "rgba(255,255,255,0.12)",
};

export function DailyPushPopup({
  dailyPush,
  open,
  onClose,
  onAddToCart,
  theme = "light",
}: DailyPushPopupProps) {
  const [justAdded, setJustAdded] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(t);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!justAdded) return;
    timeoutRef.current = setTimeout(() => {
      setJustAdded(false);
      timeoutRef.current = null;
    }, JUST_ADDED_DURATION_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [justAdded]);

  if (!open) return null;
  const dark = theme === "bar-soleil";

  const handleAddToList = (e: React.MouseEvent) => {
    e.stopPropagation();
    const item = dailyPushToMenuItem(dailyPush);
    onAddToCart(item, 1);
    setJustAdded(true);
  };

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center backdrop-blur-sm"
      style={{
        backgroundColor: dark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.55)",
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] mx-4 rounded-[22px] overflow-hidden border"
        style={{
          backgroundColor: dark ? barSoleilPopup.surface : "white",
          borderColor: dark ? barSoleilPopup.border : "#e8e4dc",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.95)",
          transition: "opacity 300ms ease, transform 300ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full h-40 flex items-center justify-center relative text-[5rem]"
          style={{ background: emojiGradient(dailyPush.item_emoji || "⭐") }}
        >
          <span>{dailyPush.item_emoji || "⭐"}</span>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md text-[0.85rem]"
            style={{
              backgroundColor: dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.9)",
              color: dark ? barSoleilPopup.text : "#555",
              border: dark ? "1px solid rgba(240,235,227,0.4)" : "none",
            }}
          >
            ✕
          </button>
        </div>
        <div className="p-5 pt-4">
          <div
            className="text-[0.58rem] uppercase tracking-[0.14em] font-semibold mb-1.5"
            style={{ color: dark ? barSoleilPopup.copper2 : "#b8966a" }}
          >
            Chef empfiehlt heute
          </div>
          <h3
            className="font-serif text-[1.7rem] font-normal leading-tight mb-2"
            style={{ color: dark ? barSoleilPopup.text : "#1a1916" }}
          >
            {dailyPush.item_name}
          </h3>
          {dailyPush.item_desc && (
            <p
              className="text-[0.8rem] leading-relaxed mb-5"
              style={{ color: dark ? barSoleilPopup.muted : "#9a948a" }}
            >
              {dailyPush.item_desc}
            </p>
          )}
          <button
            type="button"
            onClick={handleAddToList}
            className="w-full py-3.5 rounded-xl font-bold text-[0.86rem] tracking-wide"
            style={{
              ...(justAdded
                ? { backgroundColor: "rgba(122,158,110,0.35)", color: "#2d4a24" }
                : { backgroundColor: dark ? barSoleilPopup.copper : "#1a1916", color: "#fafaf8" }),
              transition: "background-color 0.3s ease, color 0.3s ease",
            }}
          >
            {justAdded ? "👍 Gemerkt" : "+ Zur Liste"}
          </button>
        </div>
      </div>
    </div>
  );
}
