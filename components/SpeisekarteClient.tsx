"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { MenuItem } from "@/lib/supabase";

const GOLD = "#C8924A";
const PLACEHOLDER_BG = "#F5E6C8";
const MAX_WIDTH = 480;

// Kategorie → Emoji für Tabs und Bildplatzhalter
const KATEGORIE_EMOJIS: Record<string, string> = {
  Frühstück: "🍳",
  Vorspeisen: "🥗",
  Hauptgerichte: "🍽",
  "Snacks & Burger": "🍔",
  Desserts: "🍰",
  Cocktails: "🍹",
  Aperitivo: "🥂",
  Wein: "🍷",
  Bier: "🍺",
  Warmgetränke: "☕",
  Softdrinks: "🥤",
};

function getKategorieEmoji(kategorie: string): string {
  return KATEGORIE_EMOJIS[kategorie] ?? "🍴";
}

function getKategorieTabLabel(kategorie: string): string {
  const emoji = getKategorieEmoji(kategorie);
  return `${emoji} ${kategorie}`;
}

type Props = {
  categories: string[];
  menuItems: MenuItem[];
  restaurantName: string;
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export default function SpeisekarteClient({
  categories,
  menuItems,
  restaurantName,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories[0] ?? null
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const kategorie = item.kategorie || "Sonstiges";
      const list = map.get(kategorie) ?? [];
      list.push(item);
      map.set(kategorie, list);
    }
    return map;
  }, [menuItems]);

  const currentItems = activeCategory
    ? itemsByCategory.get(activeCategory) ?? []
    : menuItems;

  return (
    <div
      className="min-h-screen bg-[#fafafa] text-[#1a1a1a]"
      style={{ maxWidth: MAX_WIDTH, margin: "0 auto" }}
    >
      <header className="sticky top-0 z-10 border-b border-[#eee] bg-white/95 backdrop-blur-sm px-4 py-4">
        <h1 className="text-lg font-semibold text-center" style={{ color: GOLD }}>
          {restaurantName}
        </h1>
        <p className="text-xs text-center text-[#666] mt-0.5">
          Frankfurt · Digitale Speisekarte
        </p>
      </header>

      <nav className="sticky top-[73px] z-10 bg-white border-b border-[#eee] overflow-x-auto scrollbar-hide">
        <div className="flex gap-0 min-w-0 px-2 py-2">
          {categories.map((kategorie) => {
            const isActive = activeCategory === kategorie;
            return (
              <button
                key={kategorie}
                type="button"
                onClick={() => setActiveCategory(kategorie)}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? GOLD : "transparent",
                  color: isActive ? "#fff" : "#555",
                }}
              >
                {getKategorieTabLabel(kategorie)}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="px-4 py-4 pb-8">
        {currentItems.length === 0 ? (
          <p className="text-center text-[#888] py-8 text-sm">
            In dieser Kategorie sind derzeit keine Gerichte eingetragen.
          </p>
        ) : (
          <ul className="space-y-4">
            {currentItems.map((item) => {
              const kategorieEmoji = getKategorieEmoji(
                item.kategorie?.trim() || "Sonstiges"
              );
              return (
                <li
                  key={item.id}
                  className="bg-white rounded-xl border border-[#eee] overflow-hidden shadow-sm"
                >
                  <div className="flex gap-3 p-3">
                    <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-[#eee]">
                      {item.bild_url ? (
                        <Image
                          src={item.bild_url}
                          alt={item.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-4xl"
                          style={{ backgroundColor: PLACEHOLDER_BG }}
                        >
                          {kategorieEmoji}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-[#1a1a1a] text-[15px] leading-tight">
                        {item.name}
                      </h2>
                      {item.beschreibung && (
                        <p className="text-[#666] text-xs mt-1 line-clamp-2">
                          {item.beschreibung}
                        </p>
                      )}
                      <p
                        className="mt-2 text-sm font-semibold"
                        style={{ color: GOLD }}
                      >
                        {formatPrice(item.preis)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
