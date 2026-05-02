"use client";

import { useEffect, useState } from "react";
import type { LunchOffer, MenuItem } from "@/lib/supabase";
import { activeLunchOffers } from "@/lib/lunch";
import { emojiGradient } from "@/lib/emojiGradient";
import { getItemEmoji, getDisplayPrice } from "./utils";

type LunchSectionProps = {
  offers: LunchOffer[];
  menuItems: MenuItem[];
  onItemClick: (item: MenuItem) => void;
  /** Optional: dunkler Hintergrund (z. B. BarSoleil) */
  theme?: "light" | "dark";
};

/** Rendert die "🍽️ Mittagsangebot"-Sektion, wenn aktuell mindestens ein
 *  Lunch-Offer aktiv ist (Zeitfenster + Wochentag passen). */
export default function LunchSection({
  offers,
  menuItems,
  onItemClick,
  theme = "light",
}: LunchSectionProps) {
  // Client-only: aktuelle Zeit prüfen, sonst hydration mismatch.
  const [active, setActive] = useState<LunchOffer[]>([]);

  useEffect(() => {
    const update = () => setActive(activeLunchOffers(offers));
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [offers]);

  if (active.length === 0) return null;

  const items = active
    .map((offer) => {
      const item = menuItems.find((m) => m.id === offer.item_id);
      if (!item) return null;
      return { item, offer };
    })
    .filter((x): x is { item: MenuItem; offer: LunchOffer } => x !== null);

  if (items.length === 0) return null;

  const dark = theme === "dark";
  const headlineColor = dark ? "#E8A96E" : "#b8966a";
  const titleColor = dark ? "#F0EBE3" : "#1a1916";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "#e8e4dc";
  const subTextColor = dark ? "rgba(240,235,227,0.65)" : "#6e6a62";
  const priceColor = dark ? "#E8A96E" : "#b8966a";
  const oldPriceColor = dark ? "rgba(240,235,227,0.4)" : "#9a948a";

  return (
    <section className="mb-7">
      <div
        className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
        style={{ color: headlineColor }}
      >
        Mo–Fr Mittag
      </div>
      <h2
        className="font-serif mb-3"
        style={{
          color: titleColor,
          fontSize: "1.6rem",
          fontWeight: 400,
          lineHeight: 1.1,
        }}
      >
        🍽️ Mittagsangebot
      </h2>
      <div className="flex flex-col gap-2">
        {items.map(({ item, offer }) => {
          const lunchPrice = offer.lunch_price;
          const hasDiscount =
            typeof lunchPrice === "number" &&
            !Number.isNaN(lunchPrice) &&
            lunchPrice > 0 &&
            lunchPrice < item.preis;
          return (
            <button
              key={offer.id}
              type="button"
              onClick={() => onItemClick(item)}
              className="flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
              style={{ background: cardBg, borderColor: cardBorder }}
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-2xl"
                style={{
                  background: item.bild_url
                    ? "transparent"
                    : emojiGradient(getItemEmoji(item)),
                }}
              >
                {item.bild_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.bild_url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{item.emoji ?? getItemEmoji(item) ?? "🍽️"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-semibold leading-tight"
                  style={{ color: titleColor, fontSize: "0.92rem" }}
                >
                  {item.name}
                </div>
                {item.beschreibung ? (
                  <div
                    className="mt-0.5 line-clamp-2 text-[0.74rem] leading-snug"
                    style={{ color: subTextColor }}
                  >
                    {item.beschreibung}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                {hasDiscount ? (
                  <>
                    <div
                      className="text-[0.95rem] font-bold"
                      style={{ color: priceColor }}
                    >
                      {(lunchPrice as number).toFixed(2)} €
                    </div>
                    <div
                      className="text-[0.7rem] line-through"
                      style={{ color: oldPriceColor }}
                    >
                      {getDisplayPrice(item)}
                    </div>
                  </>
                ) : (
                  <div
                    className="text-[0.95rem] font-bold"
                    style={{ color: priceColor }}
                  >
                    {typeof lunchPrice === "number" && !Number.isNaN(lunchPrice)
                      ? `${lunchPrice.toFixed(2)} €`
                      : getDisplayPrice(item)}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
