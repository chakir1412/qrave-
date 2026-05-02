"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { supabase, type MenuItem, type SponsoredItem } from "@/lib/supabase";
import {
  getDrinkSuggestions,
  isDrinkItem,
  type SponsoredSuggestion,
} from "@/lib/speisekarte-logic";
import { emojiGradient } from "@/lib/emojiGradient";
import { getItemEmoji, getDisplayPrice } from "./utils";

const JUST_ADDED_DURATION_MS = 1500;

export type ItemModalProps = {
  item: MenuItem;
  menuItems: MenuItem[];
  sponsoredItems?: SponsoredItem[];
  /** Für Tracking gesponserter Klicks (scan_events) */
  restaurantId?: string;
  onClose: () => void;
  onSelectItem: (item: MenuItem) => void;
  isInWishlist: (id: string) => boolean;
  onToggleWishlist: (item: MenuItem) => void;
  theme?: string;
};

function isSponsoredCard(s: MenuItem | SponsoredSuggestion): s is SponsoredSuggestion {
  return "isSponsored" in s && s.isSponsored === true;
}

function suggestionDisplayName(s: MenuItem | SponsoredSuggestion): string {
  return isSponsoredCard(s) ? s.item_name : s.name;
}

const IMG_GRADIENT =
  "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)";

const MODAL_BG = "#0f0f18";

const TAG_PILL_STYLES: Record<
  string,
  { label: string; style: CSSProperties }
> = {
  vegan: {
    label: "Vegan",
    style: {
      background: "rgba(52,232,158,0.15)",
      color: "#34e89e",
      border: "1px solid rgba(52,232,158,0.3)",
    },
  },
  veg: {
    label: "Vegetarisch",
    style: {
      background: "rgba(91,155,255,0.15)",
      color: "#5b9bff",
    },
  },
  vegetarisch: {
    label: "Vegetarisch",
    style: {
      background: "rgba(91,155,255,0.15)",
      color: "#5b9bff",
    },
  },
  spicy: {
    label: "Scharf",
    style: {
      background: "rgba(255,75,110,0.15)",
      color: "#ff4b6e",
    },
  },
  gf: {
    label: "Glutenfrei",
    style: {
      background: "rgba(255,212,38,0.15)",
      color: "#ffd426",
    },
  },
  glutenfrei: {
    label: "Glutenfrei",
    style: {
      background: "rgba(255,212,38,0.15)",
      color: "#ffd426",
    },
  },
  new: {
    label: "Neu",
    style: {
      background: "rgba(255,92,26,0.15)",
      color: "#ff5c1a",
    },
  },
  neu: {
    label: "Neu",
    style: {
      background: "rgba(255,92,26,0.15)",
      color: "#ff5c1a",
    },
  },
  sig: {
    label: "★ Sig",
    style: {
      background: "rgba(184,150,106,0.12)",
      color: "#b8966a",
      border: "1px solid rgba(184,150,106,0.25)",
    },
  },
};

const pillBase: CSSProperties = {
  borderRadius: 20,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 500,
};

function formatZutatenPlainLoose(zutaten: unknown[]): string {
  try {
    return zutaten
      .map((z) => {
        if (!z || typeof z !== "object") return "";
        const o = z as Record<string, unknown>;
        const bits = [
          typeof o.emoji === "string" ? o.emoji.trim() : "",
          typeof o.name === "string" ? o.name.trim() : "",
          typeof o.subtext === "string" ? o.subtext.trim() : "",
        ].filter(Boolean);
        return bits.join(" ");
      })
      .filter(Boolean)
      .join(" · ");
  } catch {
    return "";
  }
}

function safeZutatenDisplay(raw: unknown): string | null {
  try {
    if (raw == null) return null;

    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "string") return parsed.trim() || null;
        if (Array.isArray(parsed)) {
          const line = formatZutatenPlainLoose(parsed);
          return line || JSON.stringify(parsed);
        }
        if (parsed && typeof parsed === "object") {
          const line = formatZutatenPlainLoose([parsed]);
          return line || JSON.stringify(parsed);
        }
        return JSON.stringify(parsed);
      } catch {
        const t = raw.trim();
        return t || null;
      }
    }

    if (Array.isArray(raw)) {
      const line = formatZutatenPlainLoose(raw);
      return line || null;
    }

    if (typeof raw === "object" && raw !== null) {
      const line = formatZutatenPlainLoose([raw]);
      try {
        return line || JSON.stringify(raw);
      } catch {
        return line || null;
      }
    }

    return String(raw);
  } catch {
    return null;
  }
}

function safeStoryTextDisplay(raw: unknown): string | null {
  try {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "string"
          ? parsed.trim() || null
          : JSON.stringify(parsed);
      } catch {
        return raw.trim() || null;
      }
    }
    if (typeof raw === "object" && raw !== null) {
      try {
        return JSON.stringify(raw);
      } catch {
        return null;
      }
    }
    return String(raw);
  } catch {
    return null;
  }
}

function pillForTag(raw: string): { label: string; style: CSSProperties } {
  const key = raw.trim().toLowerCase();
  const mapped = TAG_PILL_STYLES[key];
  if (mapped) {
    return { label: mapped.label, style: { ...pillBase, ...mapped.style } };
  }
  return {
    label: raw,
    style: {
      ...pillBase,
      background: "rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.75)",
    },
  };
}

function suggestionPrice(s: MenuItem): string {
  const p = s.preis;
  if (typeof p === "number" && !Number.isNaN(p)) {
    return `${p.toFixed(2)} €`;
  }
  return getDisplayPrice(s);
}

function formatSuggestionPreis(s: MenuItem | SponsoredSuggestion): string {
  if (isSponsoredCard(s)) {
    const p = s.preis != null ? Number(s.preis) : NaN;
    return Number.isFinite(p) ? `${p.toFixed(2)} €` : "—";
  }
  return suggestionPrice(s);
}

export default function ItemModal({
  item,
  menuItems,
  sponsoredItems = [],
  restaurantId,
  onClose,
  onSelectItem,
  isInWishlist,
  onToggleWishlist,
}: ItemModalProps) {
  const [justAdded, setJustAdded] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inList = isInWishlist(item.id);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  const handleMainToggle = () => {
    const wasIn = isInWishlist(item.id);
    onToggleWishlist(item);
    if (!wasIn) {
      setJustAdded(true);
      const t = setTimeout(() => {
        setJustAdded(false);
      }, JUST_ADDED_DURATION_MS);
      timeoutsRef.current.push(t);
    }
  };

  const zutatenText = useMemo(() => safeZutatenDisplay(item.zutaten), [item.zutaten]);

  const zutatenPillLabels = useMemo(() => {
    if (!zutatenText) return [] as string[];
    return zutatenText
      .replace(/\s*·\s*/g, ",")
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean);
  }, [zutatenText]);

  const storyText = useMemo(() => safeStoryTextDisplay(item.story_text), [item.story_text]);

  const isCurrentItemDrink = isDrinkItem(item);

  const suggestions = useMemo(
    () =>
      isCurrentItemDrink
        ? []
        : getDrinkSuggestions(menuItems, item, sponsoredItems ?? []),
    [menuItems, item, sponsoredItems, isCurrentItemDrink],
  );

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

  const tagPills = useMemo(() => {
    try {
      let tags: unknown[] = [];
      const raw = item.tags as unknown;
      if (raw == null) tags = [];
      else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) tags = [];
        else {
          try {
            const p: unknown = JSON.parse(t);
            tags = Array.isArray(p) ? p : [p];
          } catch {
            tags = [raw];
          }
        }
      } else if (Array.isArray(raw)) {
        tags = raw;
      } else {
        tags = [raw];
      }
      return tags.map((t) => pillForTag(String(t)));
    } catch {
      return [];
    }
  }, [item.tags]);

  const muted = "rgba(255,255,255,0.55)";
  const scanCount = item.scan_count;
  const showPopularity =
    typeof scanCount === "number" && !Number.isNaN(scanCount) && scanCount > 5;
  const kategorieLabel = (item.kategorie ?? "").trim();

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center animate-[fadeIn_0.2s_ease]"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)] sm:max-h-[88vh]"
        style={{
          background: MODAL_BG,
          color: "#fff",
          borderRadius: "20px 20px 0 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-[320px] w-full shrink-0 overflow-hidden bg-[#1a1a24]">
          {item.bild_url ? (
            <Image
              src={item.bild_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 520px) 100vw, 520px"
              unoptimized
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: emojiGradient(getItemEmoji(item)) }}
            >
              <span className="text-[6rem] leading-none">{getItemEmoji(item)}</span>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 top-0"
            style={{ background: IMG_GRADIENT }}
          />
          <div
            className="absolute bottom-4 left-5 font-bold text-white"
            style={{ fontSize: 28, fontWeight: 700 }}
          >
            {getDisplayPrice(item)}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute flex items-center justify-center text-white"
            style={{
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            style={{ padding: 20, paddingBottom: 32 }}
          >
            {tagPills.length > 0 ? (
              <div className="mb-2 flex flex-wrap" style={{ gap: 6 }}>
                {tagPills.map((pill, idx) => (
                  <span key={`${pill.label}-${idx}`} style={pill.style}>
                    {pill.label}
                  </span>
                ))}
              </div>
            ) : null}

            {showPopularity || kategorieLabel ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  margin: "10px 0",
                }}
              >
                {showPopularity ? (
                  <div
                    style={{
                      background: "rgba(255,92,26,0.12)",
                      border: "1px solid rgba(255,92,26,0.25)",
                      borderRadius: 20,
                      padding: "4px 10px",
                      fontSize: 11,
                      color: "#ff5c1a",
                    }}
                  >
                    🔥 {scanCount}x diese Woche
                  </div>
                ) : null}
                {kategorieLabel ? (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 20,
                      padding: "4px 10px",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {kategorieLabel}
                  </div>
                ) : null}
              </div>
            ) : null}

            <h3
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#fff",
                marginTop: 0,
                marginBottom: item?.beschreibung ? 10 : 0,
              }}
            >
              {item?.name ?? ""}
            </h3>

            {item?.beschreibung ? (
              <p
                style={{
                  fontSize: 14,
                  color: muted,
                  lineHeight: 1.6,
                  marginBottom: 0,
                }}
              >
                {String(item.beschreibung)}
              </p>
            ) : null}

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                margin: "16px 0",
              }}
            />

            {zutatenPillLabels.length > 0 ? (
              <div>
                <div
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 8,
                  }}
                >
                  Zutaten
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {zutatenPillLabels.map((z, i) => (
                    <span
                      key={`${z}-${i}`}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 20,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {storyText ? (
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  marginTop: zutatenPillLabels.length > 0 ? 16 : 0,
                  marginBottom: 16,
                  paddingTop: 16,
                }}
              >
                <p
                  className="italic"
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.45)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  „{storyText}“
                </p>
              </div>
            ) : null}

            <div
              style={{
                marginTop:
                  zutatenPillLabels.length > 0 && !storyText
                    ? 16
                    : 0,
                borderRadius: 8,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.3)",
                  margin: 0,
                }}
              >
                <span aria-hidden className="mr-1.5 inline-block">
                  ⚠️
                </span>
                Zu Allergenen informiert Sie gerne unser Service-Team.
              </p>
            </div>

            {!isCurrentItemDrink && suggestions.length > 0 ? (
              <div
                style={{
                  marginTop: 16,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 10,
                    fontWeight: 400,
                  }}
                >
                  🍺 Oft zusammen bestellt
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                  className="scrollbar-hide"
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
                          width: 110,
                          position: "relative",
                          background: sp
                            ? "rgba(0,200,160,0.06)"
                            : "rgba(255,255,255,0.04)",
                          border: sp
                            ? "1px solid rgba(0,200,160,0.2)"
                            : "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: "pointer",
                        }}
                      >
                        {sp ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              zIndex: 1,
                              background: "#00c8a0",
                              color: "#000",
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 10,
                            }}
                          >
                            Empfehlung
                          </div>
                        ) : null}
                        {s.bild_url ? (
                          <img
                            src={s.bild_url}
                            alt={suggestionDisplayName(s)}
                            style={{
                              width: "100%",
                              height: 75,
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 75,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: sp ? 28 : 24,
                              background: sp
                                ? "rgba(255,255,255,0.06)"
                                : emojiGradient(getItemEmoji(s as MenuItem)),
                            }}
                          >
                            {sp
                              ? "🍺"
                              : (s as MenuItem).emoji || getItemEmoji(s as MenuItem) || "🍽️"}
                          </div>
                        )}
                        <div style={{ padding: "6px 8px" }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "white",
                              fontWeight: 500,
                              lineHeight: 1.3,
                              marginBottom: 2,
                            }}
                          >
                            {suggestionDisplayName(s)}
                          </div>
                          <div style={{ fontSize: 11, color: "#00c8a0" }}>
                            {formatSuggestionPreis(s)}
                          </div>
                        </div>
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
              background: MODAL_BG,
              padding: "16px 20px",
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <button
              type="button"
              onClick={handleMainToggle}
              className="w-full font-semibold"
              style={{
                height: 52,
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                ...(justAdded || inList
                  ? {
                      backgroundColor: "rgba(0,200,160,0.35)",
                      color: "#000",
                    }
                  : {
                      background: "#00c8a0",
                      color: "#000",
                    }),
                transition: "background-color 0.3s ease, color 0.3s ease",
              }}
            >
              <span aria-hidden>{inList ? "♥ " : "♡ "}</span>
              {justAdded
                ? "Gemerkt"
                : inList
                  ? "In der Merkliste"
                  : "Zur Merkliste"}
            </button>
            <p
              className="mt-2.5 text-center leading-snug"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}
            >
              Alle Angaben ohne Gewähr · Preise inkl. MwSt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
