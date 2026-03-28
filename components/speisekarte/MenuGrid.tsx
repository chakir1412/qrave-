"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { MenuItem } from "@/lib/supabase";
import { emojiGradient } from "@/lib/emojiGradient";
import { getItemEmoji, getDisplayPrice } from "./utils";
import { BADGE_STYLES, BADGE_LABELS, VOL_LABELS } from "./constants";

export type Section = { kategorie: string; subtitle: string | null; items: MenuItem[] };

/** "bar-soleil" = Dark Luxury (speisekarte-v4): heller Text, Kupfer, dunkle Karten */
type MenuGridTheme = "light" | "bar-soleil";

type MenuGridProps = {
  showHighlightSlider: boolean;
  highlights: MenuItem[];
  onAddToCart: (item: MenuItem, qty?: number) => void;
  visibleSections: Section[];
  filterItems: (items: MenuItem[]) => MenuItem[];
  onItemClick: (item: MenuItem) => void;
  activeAllergens: Set<string>;
  bannerSlot?: ReactNode;
  theme?: MenuGridTheme;
  isInWishlist?: (itemId: string) => boolean;
  /** Ref je Kategorie-Sektion für Tier-1-Tracking (IntersectionObserver) */
  onCategorySectionRef?: (kategorie: string, element: HTMLElement | null) => void;
};

const barSoleil = {
  text: "#F0EBE3",
  muted: "#8A7E70",
  dim: "#4A4238",
  copper: "#C8894E",
  copper2: "#E8A96E",
  border: "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.12)",
  card: "#221F1A",
  card2: "#2A2520",
  surface: "#1A1712",
};

export default function MenuGrid({
  showHighlightSlider,
  highlights,
  onAddToCart,
  visibleSections,
  filterItems,
  onItemClick,
  activeAllergens,
  bannerSlot,
  theme = "light",
  isInWishlist = () => false,
  onCategorySectionRef,
}: MenuGridProps) {
  const dark = theme === "bar-soleil";
  const cl = {
    secTitle: dark ? barSoleil.text : "#1a1916",
    secSub: dark ? barSoleil.muted : "#9a948a",
    secBorder: dark ? barSoleil.border : "#e8e4dc",
    itemName: dark ? barSoleil.text : "#1a1916",
    itemDesc: dark ? barSoleil.muted : "#9a948a",
    price: dark ? barSoleil.copper : "#b8966a",
    empty: dark ? barSoleil.muted : "#9a948a",
    rowBorder: dark ? barSoleil.border : "#f0ece5",
    rowHover: dark ? "rgba(255,255,255,0.04)" : "rgba(184,150,106,0.04)",
    thumbBorder: dark ? barSoleil.border : "#e8e4dc",
    legendBg: dark ? barSoleil.card : "white",
    legendBorder: dark ? barSoleil.border : "#e8e4dc",
    disclaimer: dark ? barSoleil.muted : "#9a948a",
    disclaimerBorder: dark ? barSoleil.border : "#f0ece5",
  };

  return (
    <>
      {showHighlightSlider && (
        <section className="mb-9">
          <div className={`flex items-center gap-3 text-[0.6rem] uppercase tracking-widest mb-3`} style={{ color: cl.secSub }}>
            <span className="h-px flex-1" style={{ backgroundColor: cl.secBorder }} /> ✦ EMPFEHLUNGEN ✦ <span className="h-px flex-1" style={{ backgroundColor: cl.secBorder }} />
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-snap-x snap-mandatory pb-1">
            {highlights.map((h) => {
              const emoji = getItemEmoji(h);
              return (
                <div
                  key={h.id}
                  className="flex-shrink-0 w-[216px] snap-start rounded-2xl overflow-hidden cursor-pointer transition-all"
                  style={{
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: dark ? barSoleil.border : "#e8e4dc",
                    backgroundColor: dark ? barSoleil.card : "white",
                  }}
                >
                  <div className="h-[116px] flex items-center justify-center relative" style={{ background: emojiGradient(emoji) }}>
                    <span className="text-[3rem]">{emoji}</span>
                    <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.52rem] font-bold text-white uppercase tracking-wide" style={{ backgroundColor: barSoleil.copper }}>Partner</span>
                  </div>
                  <div className="p-3">
                    <div className="text-[0.56rem] uppercase tracking-wider font-semibold mb-0.5" style={{ color: barSoleil.copper }}>{h.partner_name || "Partner"}</div>
                    <div className="font-serif text-[1.06rem] mb-1" style={{ color: cl.itemName }}>{h.name}</div>
                    <div className="text-[0.68rem] leading-snug mb-2 line-clamp-2" style={{ color: cl.itemDesc }}>{h.beschreibung}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-[1rem] font-medium" style={{ color: cl.price }}>{getDisplayPrice(h)}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (!isInWishlist(h.id)) onAddToCart(h); }}
                        disabled={isInWishlist(h.id)}
                        className="text-[0.63rem] font-bold rounded-full px-2.5 py-1 transition-[background-color,border-color,color] duration-300"
                        style={
                          isInWishlist(h.id)
                            ? { borderWidth: 1, borderStyle: "solid", borderColor: "rgba(122,158,110,0.6)", backgroundColor: "rgba(122,158,110,0.2)", color: "#7a9e6e" }
                            : { borderWidth: 1, borderStyle: "solid", borderColor: dark ? barSoleil.border2 : "#e8e4dc", color: barSoleil.copper2 }
                        }
                      >
                        {isInWishlist(h.id) ? "👍 Gemerkt" : "+ Merken"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bannerSlot}

      <div className="space-y-11">
        {visibleSections.map((sec) => {
          const filtered = filterItems(sec.items);
          return (
            <section
              key={sec.kategorie}
              className="cat-block"
              ref={(el) => onCategorySectionRef?.(sec.kategorie, el)}
            >
              <div className="flex items-baseline gap-4 pb-2.5 mb-0.5" style={{ borderBottomWidth: 1, borderBottomStyle: "solid", borderColor: cl.secBorder }}>
                <h2 className="font-serif font-light text-[clamp(1.4rem,3.5vw,1.9rem)] tracking-tight whitespace-nowrap" style={{ color: cl.secTitle }}>
                  {sec.kategorie}
                </h2>
                {sec.subtitle && <span className="text-[0.72rem] italic" style={{ color: cl.secSub }}>{sec.subtitle}</span>}
              </div>
              <div className="flex flex-col">
                {filtered.length === 0 ? (
                  <p className="text-center py-9 text-sm italic" style={{ color: cl.empty }}>Keine Gerichte für diesen Filter.</p>
                ) : (
                  filtered.map((item) => {
                    const emoji = getItemEmoji(item, sec.kategorie);
                    const tags = (item.tags ?? []).map((t) => t.toLowerCase());
                    const allergenWarn = activeAllergens.size > 0 && (item.allergen_ids ?? []).some((a) => activeAllergens.has(a as string));
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => !allergenWarn && onItemClick(item)}
                        className={`w-full flex items-center gap-3 py-3.5 text-left transition-all -mx-4 px-4 last:border-0 ${item.sponsored && !dark ? "bg-[rgba(184,150,106,0.02)]" : ""} ${allergenWarn ? "opacity-30 pointer-events-none" : ""}`}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomStyle: "solid",
                          borderColor: cl.rowBorder,
                        }}
                      >
                        <div className="flex-shrink-0 w-[68px] h-[68px] rounded-[10px] overflow-hidden flex items-center justify-center" style={{ borderWidth: 1, borderStyle: "solid", borderColor: cl.thumbBorder, background: emojiGradient(emoji) }}>
                          {item.bild_url ? (
                            <Image src={item.bild_url} alt={item.name} width={68} height={68} className="w-full h-full object-cover" unoptimized />
                          ) : (
                            <span className="text-[1.75rem]">{emoji}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {item.sponsored && item.partner_name && (
                            <div className="text-[0.55rem] uppercase tracking-wider font-medium mb-0.5" style={{ color: barSoleil.copper2 }}>★ Empfohlen von {item.partner_name}</div>
                          )}
                          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                            <span className="font-serif text-[1.06rem]" style={{ color: cl.itemName }}>{item.name}</span>
                            {tags.map((t) => BADGE_LABELS[t] && <span key={t} className={`text-[0.52rem] font-semibold px-1.5 py-0.5 rounded-full uppercase ${BADGE_STYLES[t]}`}>{BADGE_LABELS[t]}</span>)}
                          </div>
                          {item.beschreibung && <p className="text-[0.71rem] italic leading-snug line-clamp-2" style={{ color: cl.itemDesc }}>{item.beschreibung}</p>}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {item.preis_volumen && typeof item.preis_volumen === "object" && Object.keys(item.preis_volumen).length > 0 ? (
                            <div className="flex gap-3">
                              {(["g", "m", "l", "btl"] as const).map((k) => (item.preis_volumen as Record<string, string>)[k] && (
                                <div key={k} className="text-center">
                                  <span className="block text-[0.55rem]" style={{ color: cl.itemDesc }}>{VOL_LABELS[k]}</span>
                                  <span className="font-serif text-[0.9rem] font-medium" style={{ color: cl.price }}>{(item.preis_volumen as Record<string, string>)[k]}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-serif text-[1.05rem] font-medium" style={{ color: cl.price }}>{getDisplayPrice(item)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-11 p-4 rounded-xl" style={{ borderWidth: 1, borderStyle: "solid", borderColor: cl.legendBorder, backgroundColor: cl.legendBg }}>
        <div className="text-[0.92rem] font-serif tracking-wide mb-2.5" style={{ color: cl.secSub }}>Legende</div>
        <div className="flex flex-wrap gap-2">
          {["vegan", "veg", "gf", "spicy", "new", "sig"].map((b) => (
            <span key={b} className="text-[0.68rem] flex items-center gap-1" style={{ color: cl.secSub }}>
              <span className={`text-[0.52rem] font-semibold px-1.5 py-0.5 rounded-full uppercase ${BADGE_STYLES[b]}`}>{BADGE_LABELS[b]}</span>
              {b === "vegan" ? "Vegan" : b === "veg" ? "Vegetarisch" : b === "gf" ? "Glutenfrei" : b === "spicy" ? "Scharf" : b === "new" ? "Neuheit" : "Signature"}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[0.66rem] text-center leading-relaxed mt-5 pt-4" style={{ color: cl.disclaimer, borderTopWidth: 1, borderTopStyle: "solid", borderColor: cl.disclaimerBorder }}>
        ⚠️ Zu Allergenen und Unverträglichkeiten informiert Sie gerne unser Service-Team.<br />Alle Angaben ohne Gewähr · Preise inkl. MwSt.
      </p>
    </>
  );
}
