"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { supabase, type MenuItem, type SponsoredItem } from "@/lib/supabase";
import {
  getCompanionSuggestions,
  getDrinkSuggestions,
  isDrinkItem,
  type SponsoredSuggestion,
} from "@/lib/speisekarte-logic";
import { getItemEmoji, getDisplayPrice } from "@/components/speisekarte/utils";

const JUST_ADDED_DURATION_MS = 300;

type ColorTokens = {
  bg: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  divider: string;
  cream: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  overlay: string;
};

/** Light Theme (Heritage Default) — cream/gold. */
const LIGHT_THEME: ColorTokens = {
  bg: "#FFFFFF",
  text: "#1A1209",
  textMuted: "#6E665C",
  textSubtle: "#9A948A",
  accent: "#C8894E",
  accentSoft: "rgba(200,137,78,0.08)",
  accentBorder: "rgba(200,137,78,0.3)",
  divider: "rgba(200,137,78,0.18)",
  cream: "#F5F0E8",
  pillBg: "#F5F0E8",
  pillBorder: "rgba(200,137,78,0.18)",
  pillText: "#1A1209",
  overlay: "rgba(26,18,9,0.4)",
};

/** Dark Theme — für Noir / Asian Dark / Street Food. */
const DARK_THEME: ColorTokens = {
  bg: "#0d0d0f",
  text: "#f0eee8",
  textMuted: "rgba(240,238,232,0.6)",
  textSubtle: "rgba(240,238,232,0.4)",
  accent: "#c9a84c",
  accentSoft: "rgba(201,168,76,0.08)",
  accentBorder: "rgba(201,168,76,0.35)",
  divider: "rgba(255,255,255,0.08)",
  cream: "rgba(255,255,255,0.04)",
  pillBg: "rgba(255,255,255,0.04)",
  pillBorder: "rgba(255,255,255,0.08)",
  pillText: "rgba(240,238,232,0.85)",
  overlay: "rgba(0,0,0,0.6)",
};

/** Playful Theme — Pink-Akzent auf weißem Modal-Hintergrund. */
const PLAYFUL_THEME: ColorTokens = {
  bg: "#ffffff",
  text: "#1a0a12",
  textMuted: "rgba(26,10,18,0.6)",
  textSubtle: "rgba(26,10,18,0.4)",
  accent: "#ff3d7f",
  accentSoft: "rgba(255,61,127,0.08)",
  accentBorder: "rgba(255,61,127,0.4)",
  divider: "rgba(26,10,18,0.1)",
  cream: "#ffe5f0",
  pillBg: "#ffe5f0",
  pillBorder: "rgba(255,61,127,0.25)",
  pillText: "#1a0a12",
  overlay: "rgba(26,10,18,0.5)",
};

const THEMES = { light: LIGHT_THEME, dark: DARK_THEME, playful: PLAYFUL_THEME } as const;
export type ModalTheme = keyof typeof THEMES;

export type HeritageItemModalProps = {
  item: MenuItem;
  menuItems: MenuItem[];
  sponsoredItems?: SponsoredItem[];
  restaurantId?: string;
  onClose: () => void;
  onSelectItem: (item: MenuItem) => void;
  isInWishlist: (id: string) => boolean;
  onToggleWishlist: (item: MenuItem) => void;
  onAddToWishlist?: (item: MenuItem, qty: number) => void;
  /** Visuelle Variante. Default "light" (Heritage/Clean/Trattoria/Minimal/
   *  Mediterranean). "dark" für Noir/AsianDark/StreetFood. "playful" für
   *  Pink-Akzent (Playful-Template). */
  theme?: ModalTheme;
};

function isSponsoredCard(s: MenuItem | SponsoredSuggestion): s is SponsoredSuggestion {
  return "isSponsored" in s && s.isSponsored === true;
}

function suggestionDisplayName(s: MenuItem | SponsoredSuggestion): string {
  return isSponsoredCard(s) ? s.item_name : s.name;
}

function suggestionPriceText(s: MenuItem | SponsoredSuggestion): string {
  if (isSponsoredCard(s)) {
    const p = s.preis != null ? Number(s.preis) : NaN;
    return Number.isFinite(p) ? `${p.toFixed(2)} €` : "—";
  }
  if (typeof s.preis === "number" && !Number.isNaN(s.preis)) {
    return `${s.preis.toFixed(2)} €`;
  }
  return getDisplayPrice(s);
}

function safeZutatenList(raw: unknown): string[] {
  try {
    if (raw == null) return [];
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) return [];
      try {
        const parsed: unknown = JSON.parse(t);
        if (Array.isArray(parsed)) {
          return parsed
            .map((z) => {
              if (!z || typeof z !== "object") return "";
              const o = z as Record<string, unknown>;
              return typeof o.name === "string" ? o.name.trim() : "";
            })
            .filter(Boolean);
        }
        return [];
      } catch {
        return t
          .split(/[,·]/)
          .map((p) => p.trim())
          .filter(Boolean);
      }
    }
    if (Array.isArray(raw)) {
      return raw
        .map((z) => {
          if (!z || typeof z !== "object") return "";
          const o = z as Record<string, unknown>;
          return typeof o.name === "string" ? o.name.trim() : "";
        })
        .filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function safeStoryText(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") return raw.trim() || null;
  return null;
}

const TAG_LABELS: Record<string, string> = {
  vegan: "🌱 Vegan",
  veg: "🌿 Vegetarisch",
  vegetarisch: "🌿 Vegetarisch",
  gf: "🚫 Glutenfrei",
  glutenfrei: "🚫 Glutenfrei",
  spicy: "🌶 Scharf",
  scharf: "🌶 Scharf",
  new: "Neu",
  neu: "Neu",
  sig: "★ Signature",
};

function makeTagPillStyle(col: ColorTokens): CSSProperties {
  return {
    background: col.pillBg,
    border: `1px solid ${col.pillBorder}`,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 11,
    color: col.pillText,
  };
}

function tagPillLabel(raw: string): string {
  const k = raw.trim().toLowerCase();
  return TAG_LABELS[k] ?? raw;
}

export default function HeritageItemModal({
  item,
  menuItems,
  sponsoredItems = [],
  restaurantId,
  onClose,
  onSelectItem,
  isInWishlist,
  onToggleWishlist,
  onAddToWishlist,
  theme = "light",
}: HeritageItemModalProps) {
  const COL = THEMES[theme];
  const tagPillStyle = makeTagPillStyle(COL);
  const [justAdded, setJustAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const [allergensOpen, setAllergensOpen] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setQty(1);
    setJustAdded(false);
    setAllergensOpen(false);
  }, [item.id]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  const handleAdd = () => {
    if (onAddToWishlist) {
      onAddToWishlist(item, qty);
    } else if (!isInWishlist(item.id)) {
      onToggleWishlist(item);
    }
    setJustAdded(true);
    const t = setTimeout(() => setJustAdded(false), JUST_ADDED_DURATION_MS);
    timeoutsRef.current.push(t);
  };

  const decQty = () => setQty((q) => Math.max(1, q - 1));
  const incQty = () => setQty((q) => Math.min(99, q + 1));

  const zutatenLabels = useMemo(() => safeZutatenList(item.zutaten), [item.zutaten]);
  const storyText = useMemo(() => safeStoryText(item.story_text), [item.story_text]);

  const tagPills = useMemo(() => {
    try {
      const raw = item.tags as unknown;
      if (!Array.isArray(raw)) return [] as string[];
      return raw.map((t) => tagPillLabel(String(t)));
    } catch {
      return [] as string[];
    }
  }, [item.tags]);

  const isCurrentItemDrink = isDrinkItem(item);
  const suggestions = useMemo<(MenuItem | SponsoredSuggestion)[]>(() => {
    const companions = getCompanionSuggestions(menuItems, item, 3);
    if (companions.length > 0) return companions;
    if (isCurrentItemDrink) return [];
    return getDrinkSuggestions(menuItems, item, sponsoredItems ?? []);
  }, [menuItems, item, sponsoredItems, isCurrentItemDrink]);

  const handleSuggestionActivate = async (s: MenuItem | SponsoredSuggestion) => {
    if (isSponsoredCard(s)) {
      if (restaurantId) {
        const { error } = await supabase.from("scan_events").insert({
          restaurant_id: restaurantId,
          event_type: "sponsored_click",
          partner_name: s.partner_name,
          item_name: s.item_name,
          produkt: s.item_name,
          tier: 0,
        });
        if (error) console.error("sponsored_click", error);
      }
      return;
    }
    onSelectItem(s);
  };

  const hasImage = Boolean(item.bild_url);
  const kategorieLabel = (item.kategorie ?? "").trim();
  const scanCount = item.scan_count;
  const showPopularity =
    typeof scanCount === "number" && !Number.isNaN(scanCount) && scanCount > 5;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center animate-[fadeIn_0.2s_ease]"
      style={{ background: COL.overlay, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)] sm:max-h-[88vh]"
        style={{
          background: COL.bg,
          color: COL.text,
          borderRadius: "20px 20px 0 0",
          border: `1px solid ${COL.divider}`,
          borderBottom: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Close-Button — bleibt beim Scroll immer oben sichtbar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute flex items-center justify-center"
          style={{
            top: 12,
            right: 12,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: COL.bg,
            color: COL.text,
            border: `1px solid ${COL.divider}`,
            cursor: "pointer",
            zIndex: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
          aria-label="Schließen"
        >
          ✕
        </button>
        {hasImage ? (
          <div
            className="relative h-[200px] w-full shrink-0 overflow-hidden sm:h-[280px]"
            style={{ background: COL.cream }}
          >
            <Image
              src={item.bild_url as string}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 520px) 100vw, 520px"
              unoptimized
            />
          </div>
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            style={{
              padding: hasImage ? "16px 18px 28px" : "16px 18px 28px",
              paddingTop: hasImage ? 16 : 56,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {tagPills.length > 0 ? (
              <div className="mb-3 flex flex-wrap" style={{ gap: 6 }}>
                {tagPills.map((label, idx) => (
                  <span key={`${label}-${idx}`} style={tagPillStyle}>
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-3">
              <h3
                style={{
                  fontFamily: 'Georgia, "Times New Roman", ui-serif, serif',
                  fontSize: 26,
                  fontWeight: 400,
                  color: COL.text,
                  margin: 0,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.name}
              </h3>
              <div
                style={{
                  fontFamily: 'Georgia, "Times New Roman", ui-serif, serif',
                  fontSize: 22,
                  fontWeight: 500,
                  color: COL.accent,
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.02em",
                }}
              >
                {getDisplayPrice(item)}
              </div>
            </div>

            {(showPopularity || kategorieLabel) && (
              <div className="mt-2 flex flex-wrap" style={{ gap: 6 }}>
                {kategorieLabel ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: COL.textMuted,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {kategorieLabel.toUpperCase()}
                  </span>
                ) : null}
                {showPopularity ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: COL.accent,
                      marginLeft: kategorieLabel ? 8 : 0,
                    }}
                  >
                    🔥 {scanCount}× diese Woche
                  </span>
                ) : null}
              </div>
            )}

            {item.beschreibung ? (
              <p
                style={{
                  fontSize: 14,
                  color: COL.textMuted,
                  lineHeight: 1.6,
                  margin: "12px 0 0",
                }}
              >
                {String(item.beschreibung)}
              </p>
            ) : null}

            <div
              style={{
                borderTop: `1px solid ${COL.divider}`,
                margin: "20px 0 16px",
              }}
            />

            {zutatenLabels.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: COL.accent,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Zutaten
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {zutatenLabels.map((z, i) => (
                    <span key={`${z}-${i}`} style={tagPillStyle}>
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {storyText ? (
              <p
                className="italic"
                style={{
                  fontFamily: 'Georgia, "Times New Roman", ui-serif, serif',
                  fontSize: 14,
                  color: COL.textMuted,
                  lineHeight: 1.6,
                  margin: "0 0 16px",
                }}
              >
                „{storyText}"
              </p>
            ) : null}

            <div
              style={{
                borderRadius: 8,
                background: COL.cream,
                border: `1px solid ${COL.divider}`,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setAllergensOpen((v) => !v)}
                aria-expanded={allergensOpen}
                aria-controls="allergens-panel"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: COL.accent,
                    fontWeight: 600,
                  }}
                >
                  Allergene & Zutaten
                </span>
                <span
                  aria-hidden
                  style={{
                    fontSize: 14,
                    color: COL.accent,
                    transition: "transform 200ms ease",
                    transform: allergensOpen ? "rotate(180deg)" : "rotate(0deg)",
                    lineHeight: 1,
                  }}
                >
                  ▾
                </span>
              </button>
              {allergensOpen ? (
                <div
                  id="allergens-panel"
                  style={{
                    padding: "0 16px 14px",
                    borderTop: `1px solid ${COL.divider}`,
                    paddingTop: 12,
                  }}
                >
                  {item.allergens_text && item.allergens_text.trim() ? (
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: COL.text,
                        margin: "0 0 10px",
                      }}
                    >
                      {item.allergens_text}
                    </p>
                  ) : null}
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: COL.textMuted,
                      margin: 0,
                    }}
                  >
                    <span aria-hidden className="mr-1.5 inline-block">
                      ⚠️
                    </span>
                    Bitte informieren Sie zusätzlich unser Service-Team über Ihre Allergien.
                  </p>
                </div>
              ) : null}
            </div>

            {suggestions.length > 0 ? (
              <div
                style={{
                  marginTop: 22,
                  borderTop: `1px solid ${COL.divider}`,
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: COL.accent,
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  Oft zusammen bestellt
                </div>
                <div
                  className="scrollbar-hide"
                  style={{
                    display: "flex",
                    gap: 10,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {suggestions.map((s) => {
                    const sp = isSponsoredCard(s);
                    const rowKey = sp ? `sponsored-${s.id}` : (s as MenuItem).id;
                    return (
                      <div
                        key={rowKey}
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleSuggestionActivate(s)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleSuggestionActivate(s);
                          }
                        }}
                        style={{
                          flexShrink: 0,
                          width: 140,
                          background: COL.bg,
                          border: `1px solid ${COL.divider}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {sp ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              zIndex: 1,
                              background: COL.accent,
                              color: "#fff",
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 10,
                              letterSpacing: "0.08em",
                            }}
                          >
                            EMPFEHLUNG
                          </div>
                        ) : null}
                        {s.bild_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.bild_url}
                            alt={suggestionDisplayName(s)}
                            style={{
                              width: "100%",
                              height: 86,
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ) : (() => {
                          const mi = s as MenuItem;
                          const fallbackEmoji = mi.emoji || getItemEmoji(mi);
                          return (
                            <div
                              style={{
                                height: 86,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 32,
                                background: COL.cream,
                              }}
                            >
                              {sp ? (
                                "🍺"
                              ) : fallbackEmoji ? (
                                fallbackEmoji
                              ) : (
                                <i
                                  className="fa-solid fa-utensils"
                                  style={{ fontSize: 26, color: COL.textMuted }}
                                />
                              )}
                            </div>
                          );
                        })()}
                        <div style={{ padding: "8px 10px", paddingBottom: 32 }}>
                          <div
                            style={{
                              fontFamily:
                                'Georgia, "Times New Roman", ui-serif, serif',
                              fontSize: 13,
                              color: COL.text,
                              lineHeight: 1.25,
                              marginBottom: 2,
                            }}
                          >
                            {suggestionDisplayName(s)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: COL.accent,
                              fontWeight: 500,
                            }}
                          >
                            {suggestionPriceText(s)}
                          </div>
                        </div>
                        {!sp ? (
                          (() => {
                            const inList = isInWishlist((s as MenuItem).id);
                            return (
                              <button
                                type="button"
                                aria-label={inList ? "Aus Merkliste entfernen" : "Zur Merkliste hinzufügen"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const mi = s as MenuItem;
                                  if (onAddToWishlist && !inList) {
                                    onAddToWishlist(mi, 1);
                                  } else {
                                    onToggleWishlist(mi);
                                  }
                                }}
                                style={{
                                  position: "absolute",
                                  bottom: 8,
                                  right: 8,
                                  padding: "3px 10px",
                                  borderRadius: 100,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  letterSpacing: "0.02em",
                                  border: inList
                                    ? `1px solid ${COL.accent}`
                                    : `1px solid ${COL.divider}`,
                                  background: inList
                                    ? "rgba(200,137,78,0.16)"
                                    : "rgba(255,255,255,0.92)",
                                  color: inList ? COL.accent : COL.textMuted,
                                  cursor: "pointer",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                                  transition: "all 0.18s",
                                }}
                              >
                                {inList ? "Gemerkt" : "Merken"}
                              </button>
                            );
                          })()
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="sticky bottom-0 z-[2] shrink-0"
            style={{
              background: COL.bg,
              padding: "10px 22px 14px",
              borderTop: `1px solid ${COL.divider}`,
            }}
          >
            <div className="flex items-center gap-2" style={{ height: 48 }}>
              <div
                className="flex shrink-0 items-center"
                style={{
                  height: 48,
                  borderRadius: 12,
                  border: `1px solid ${COL.divider}`,
                  background: COL.cream,
                  padding: "0 4px",
                }}
              >
                <button
                  type="button"
                  onClick={decQty}
                  disabled={qty <= 1}
                  aria-label="Menge verringern"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold transition active:scale-95 disabled:opacity-40"
                  style={{
                    background: "transparent",
                    color: COL.text,
                    border: "none",
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    minWidth: "1.6rem",
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    color: COL.text,
                  }}
                  aria-live="polite"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={incQty}
                  disabled={qty >= 99}
                  aria-label="Menge erhöhen"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold transition active:scale-95 disabled:opacity-40"
                  style={{
                    background: "transparent",
                    color: COL.text,
                    border: "none",
                  }}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 font-semibold transition"
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  background: justAdded ? "#22c55e" : COL.accent,
                  color: "#fff",
                }}
              >
                <span aria-hidden className="mr-2">
                  {justAdded ? "✓" : "♡"}
                </span>
                {justAdded ? "Hinzugefügt" : "Zur Merkliste"}
              </button>
            </div>
            <p
              className="mt-2 text-center"
              style={{
                fontSize: 10,
                color: COL.textSubtle,
                letterSpacing: "0.04em",
              }}
            >
              Alle Angaben ohne Gewähr · Preise inkl. MwSt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
