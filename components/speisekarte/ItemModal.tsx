"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { MenuItem } from "@/lib/supabase";
import { emojiGradient } from "@/lib/emojiGradient";
import { getItemEmoji, getDisplayPrice } from "./utils";

const JUST_ADDED_DURATION_MS = 1500;

type ItemModalTheme = "light" | "bar-soleil";

type ItemModalProps = {
  item: MenuItem;
  allItems: MenuItem[];
  onClose: () => void;
  onAddToCart: (item: MenuItem, qty?: number) => void;
  isInWishlist?: (itemId: string) => boolean;
  theme?: ItemModalTheme;
};

export default function ItemModal({
  item,
  allItems,
  onClose,
  onAddToCart,
  theme = "light",
}: ItemModalProps) {
  const [justAdded, setJustAdded] = useState(false);
  const [justAddedIds, setJustAddedIds] = useState<string[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dark = theme === "bar-soleil";

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  const handleMainAdd = () => {
    onAddToCart(item);
    setJustAdded(true);
    const t = setTimeout(() => {
      setJustAdded(false);
    }, JUST_ADDED_DURATION_MS);
    timeoutsRef.current.push(t);
  };

  const handleAlsoOrderedAdd = (o: MenuItem) => {
    onAddToCart(o);
    setJustAddedIds((prev) => [...prev, o.id]);
    const t = setTimeout(() => {
      setJustAddedIds((prev) => prev.filter((id) => id !== o.id));
    }, JUST_ADDED_DURATION_MS);
    timeoutsRef.current.push(t);
  };

  const geschmacksprofilEntries = item.geschmacksprofil
    ? Object.entries(item.geschmacksprofil).filter(([_, v]) => typeof v === "number")
    : [];

  const suggestions: MenuItem[] = useMemo(() => {
    const mainTab = (item.main_tab ?? "").trim().toLowerCase();
    const cat = (item.kategorie ?? "").trim();
    const others = allItems.filter((i) => i.id !== item.id);

    const drinks = others.filter(
      (i) => (i.main_tab ?? "").trim().toLowerCase() === "getraenke",
    );

    const byName = (name: string) =>
      drinks.find((d) => d.name.toLowerCase() === name.toLowerCase());

    const addIf = (arr: MenuItem[], candidate: MenuItem | undefined | null) => {
      if (!candidate) return arr;
      if (arr.some((x) => x.id === candidate.id)) return arr;
      arr.push(candidate);
      return arr;
    };

    const nameLower = item.name.toLowerCase();
    const picks: MenuItem[] = [];

    const isFish =
      nameLower.includes("lachs") ||
      nameLower.includes("garnelen") ||
      nameLower.includes("ceviche") ||
      nameLower.includes("fisch");
    const isMeat =
      nameLower.includes("ribeye") ||
      nameLower.includes("burger") ||
      nameLower.includes("steak") ||
      nameLower.includes("fleisch");
    const isPasta =
      nameLower.includes("pasta") ||
      nameLower.includes("risotto") ||
      nameLower.includes("tagliatelle");

    // Getränke-Begleitung nur für Speisen/Snacks/Desserts/Frühstück
    if (mainTab !== "getraenke") {
      if (isFish) {
        addIf(picks, byName("Grauburgunder"));
        addIf(picks, byName("Wasser still"));
        addIf(picks, byName("Fever Tree Tonic"));
      } else if (isMeat) {
        addIf(picks, byName("Malbec"));
        addIf(picks, byName("Augustiner Hell"));
        addIf(picks, byName("Craft IPA"));
      } else if (isPasta) {
        addIf(picks, byName("Malbec"));
        addIf(picks, byName("Grauburgunder"));
      } else if (cat === "Vorspeisen") {
        addIf(picks, byName("Grauburgunder"));
        addIf(picks, byName("Rosé Provence"));
        addIf(picks, byName("Wasser still"));
      } else if (cat === "Desserts") {
        addIf(picks, byName("Espresso"));
        addIf(picks, byName("Cappuccino"));
        addIf(picks, byName("Flat White"));
      } else if (cat === "Frühstück") {
        addIf(picks, byName("Espresso"));
        addIf(picks, byName("Cappuccino"));
        addIf(picks, byName("Orangensaft"));
        addIf(picks, byName("Wasser still"));
      } else if (mainTab === "snacks" || cat.includes("Snack") || cat.includes("Burger")) {
        addIf(picks, byName("Craft IPA"));
        addIf(picks, byName("Augustiner Hell"));
        addIf(picks, byName("Fritz Kola"));
      }
    }

    // Fallback: Wein, Softdrinks, Warmgetränke
    if (picks.length === 0) {
      const wine = drinks.filter((d) => d.kategorie === "Wein");
      const soft = drinks.filter((d) => d.kategorie === "Softdrinks");
      const warm = drinks.filter((d) => d.kategorie === "Warmgetränke");
      const ordered = [...wine, ...soft, ...warm];
      for (const d of ordered) {
        if (picks.length >= 4) break;
        addIf(picks, d);
      }
    }

    return picks.slice(0, 4);
  }, [item, allItems]);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.22s_ease] sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-[22px] flex flex-col overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]"
        style={{
          backgroundColor: dark ? "#1C1914" : "#ffffff",
          color: dark ? "#F0EBE3" : "#1a1916",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full max-h-[280px] min-h-[200px] flex items-center justify-center flex-shrink-0 relative"
          style={{ background: emojiGradient(getItemEmoji(item)) }}
        >
          {item.bild_url ? (
            <Image
              src={item.bild_url}
              alt={item.name}
              width={400}
              height={280}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-[6rem]">{getItemEmoji(item)}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md"
            style={{
              backgroundColor: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)",
              color: dark ? "#F0EBE3" : "#555",
              border: dark ? "1px solid rgba(240,235,227,0.5)" : "none",
            }}
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <h3
            className="font-serif text-[1.85rem] font-normal mb-1"
            style={{ color: dark ? "#F0EBE3" : "#1a1916" }}
          >
            {item.name}
          </h3>
          <p
            className="font-serif text-[1.3rem] font-medium mb-2"
            style={{ color: dark ? "#C8894E" : "#b8966a" }}
          >
            {getDisplayPrice(item)}
          </p>
          {item.story_text && (
            <p
              className="text-[0.86rem] italic leading-relaxed mb-3"
              style={{ color: dark ? "#F0EBE3" : "#5f574a" }}
            >
              {item.story_text}
            </p>
          )}
          {item.beschreibung && (
            <p
              className="text-[0.82rem] leading-relaxed mb-4"
              style={{
                color: dark ? "#8A7E70" : "#9a948a",
                borderBottom: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #f0ece5",
                paddingBottom: 12,
              }}
            >
              {item.beschreibung}
            </p>
          )}
          {item.zutaten && item.zutaten.length > 0 && (
            <div className="pt-3 pb-2">
              <div
                className="text-[0.7rem] uppercase tracking-[0.16em] font-semibold mb-2"
                style={{ color: dark ? "#FFD600" : "#b8966a" }}
              >
                Zutaten
              </div>
              <div className="space-y-2">
                {item.zutaten.map((zutat, idx) => (
                  <div
                    key={`${zutat.name}-${idx}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{
                      backgroundColor: dark ? "rgba(255,255,255,0.03)" : "#f5f4f0",
                      border: dark
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid #e8e4dc",
                    }}
                  >
                    <div className="text-[1.4rem] flex-shrink-0">{zutat.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[0.85rem] font-semibold truncate"
                        style={{ color: dark ? "#F0EBE3" : "#1a1916" }}
                      >
                        {zutat.name}
                      </div>
                      {zutat.subtext && (
                        <div
                          className="text-[0.72rem] leading-snug"
                          style={{ color: dark ? "#8A7E70" : "#9a948a" }}
                        >
                          {zutat.subtext}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {geschmacksprofilEntries.length > 0 && (
            <div className="pt-3 pb-1">
              <div
                className="text-[0.7rem] uppercase tracking-[0.16em] font-semibold mb-2"
                style={{ color: dark ? "#FFD600" : "#b8966a" }}
              >
                Geschmacksprofil
              </div>
              <div className="space-y-1.5">
                {geschmacksprofilEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div
                      className="text-[0.72rem] min-w-[72px] capitalize"
                      style={{ color: dark ? "#F0EBE3" : "#5f574a" }}
                    >
                      {key}
                    </div>
                    <div className="flex-1 h-[6px] rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#f0ece5",
                        }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, value))}%`,
                            background: dark
                              ? "linear-gradient(90deg,#FFD600,#FF6D00)"
                              : "linear-gradient(90deg,#b8966a,#e8a96e)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="pt-4">
              <div
                className="text-[0.66rem] uppercase tracking-wider font-semibold mb-2 px-1"
                style={{ color: dark ? "#8A7E70" : "#9a948a" }}
              >
                Dazu passend
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {suggestions.map((o) => (
                  <div
                    key={o.id}
                    className="flex-shrink-0 w-[126px] rounded-xl overflow-hidden"
                    style={{
                      border: dark
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid #e8e4dc",
                      backgroundColor: dark ? "#1E1E1E" : "#f5f4f0",
                    }}
                  >
                    <div
                      className="h-[84px] flex items-center justify-center"
                      style={{ background: emojiGradient(getItemEmoji(o)) }}
                    >
                      <span className="text-[2rem]">{getItemEmoji(o)}</span>
                    </div>
                    <div className="p-2">
                      <div
                        className="text-[0.73rem] font-semibold leading-tight truncate"
                        style={{ color: dark ? "#F0EBE3" : "#1a1916" }}
                      >
                        {o.name}
                      </div>
                      <div
                        className="text-[0.7rem] font-semibold mb-1"
                        style={{ color: dark ? "#FFD600" : "#b8966a" }}
                      >
                        {getDisplayPrice(o)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAlsoOrderedAdd(o)}
                        className="w-full py-1 rounded-md border text-[0.62rem] font-bold"
                        style={{
                          ...(justAddedIds.includes(o.id)
                            ? {
                                borderColor: dark ? "#7a9e6e" : "#4a6d3e",
                                backgroundColor: dark
                                  ? "rgba(122,158,110,0.2)"
                                  : "rgba(122,158,110,0.15)",
                                color: dark ? "#4a6d3e" : "#4a6d3e",
                              }
                            : {
                                borderColor: dark ? "rgba(255,255,255,0.14)" : "#e8e4dc",
                                color: dark ? "#F0EBE3" : "#1a1916",
                              }),
                          transition:
                            "background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease",
                        }}
                      >
                        {justAddedIds.includes(o.id) ? "👍 Gemerkt" : "+ Hinzufügen"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div
          className="p-4 pt-3 border-t"
          style={{
            borderColor: dark ? "rgba(255,255,255,0.12)" : "#f0ece5",
            backgroundColor: dark ? "#1C1914" : "#ffffff",
          }}
        >
          <button
            type="button"
            onClick={handleMainAdd}
            className="w-full py-3.5 rounded-xl font-bold text-[0.86rem] tracking-wide"
            style={{
              ...(justAdded
                ? {
                    backgroundColor: dark
                      ? "rgba(122,158,110,0.25)"
                      : "rgba(122,158,110,0.25)",
                    color: "#4a6d3e",
                  }
                : {
                    backgroundColor: dark ? "#C8894E" : "#1a1916",
                    color: "#fafaf8",
                  }),
              transition: "background-color 0.3s ease, color 0.3s ease",
            }}
          >
            {justAdded ? "👍 Gemerkt" : "+ Zur Merkliste"}
          </button>
          <p
            className="text-[0.62rem] text-center mt-2.5 leading-snug"
            style={{ color: dark ? "#8A7E70" : "#9a948a" }}
          >
            ⚠️ Zu Allergenen informiert Sie gerne unser Service-Team. Alle Angaben ohne Gewähr ·
            Preise inkl. MwSt.
          </p>
        </div>
      </div>
    </div>
  );
}
