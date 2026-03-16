"use client";

import type { MenuItem } from "@/lib/supabase";
import { formatPrice, getItemEmoji, getDisplayPrice } from "./utils";

type CartItem = { item: MenuItem; qty: number };

type PresentationModeProps = {
  open: boolean;
  onClose: () => void;
  restaurantName: string;
  cart: CartItem[];
  cartTotal: number;
};

export default function PresentationMode({
  open,
  onClose,
  restaurantName,
  cart,
  cartTotal,
}: PresentationModeProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex flex-col"
      style={{ backgroundColor: "#0F0D0A" }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: "#8A7E70" }}>
            Bestellung für
          </div>
          <div className="font-[var(--font-playfair,ui-serif)] text-[1.6rem] tracking-[-0.03em]" style={{ color: "#F0EBE3" }}>
            {restaurantName}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-full text-[0.8rem] font-semibold uppercase tracking-[0.16em]"
          style={{
            backgroundColor: "transparent",
            border: "1px solid rgba(240,235,227,0.4)",
            color: "#F0EBE3",
          }}
        >
          Zurück
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="text-[3rem]">🛒</div>
            <div className="text-[1.1rem]" style={{ color: "#F0EBE3" }}>
              Noch keine Positionen auf der Liste.
            </div>
          </div>
        ) : (
          <div className="max-w-[720px] mx-auto w-full">
            <div className="mb-4">
              <div className="text-[0.8rem] uppercase tracking-[0.18em]" style={{ color: "#8A7E70" }}>
                Übersicht
              </div>
            </div>
            <ul className="space-y-3">
              {cart.map(({ item, qty }) => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl"
                  style={{
                    backgroundColor: "#1C1914",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl text-[2rem]" style={{ backgroundColor: "#2C2820" }}>
                    {getItemEmoji(item)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[1.05rem] font-semibold leading-snug"
                      style={{ color: "#F0EBE3" }}
                    >
                      {item.name}
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span
                        className="text-[0.9rem] font-mono"
                        style={{ color: "#F0EBE3" }}
                      >
                        {getDisplayPrice(item)}
                      </span>
                      <span
                        className="text-[0.8rem] uppercase tracking-[0.16em]"
                        style={{ color: "#8A7E70" }}
                      >
                        Menge: {qty}×
                      </span>
                    </div>
                  </div>
                  <div
                    className="text-[1.05rem] font-semibold"
                    style={{ color: "#C8894E" }}
                  >
                    {formatPrice(item.preis * qty)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <footer
          className="px-6 py-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#0F0D0A" }}
        >
          <div className="max-w-[720px] mx-auto flex items-baseline justify-between">
            <div>
              <div
                className="text-[0.8rem] uppercase tracking-[0.18em]"
                style={{ color: "#8A7E70" }}
              >
                Gesamt
              </div>
              <div
                className="text-[0.9rem]"
                style={{ color: "#F0EBE3" }}
              >
                (unverbindliche Preisübersicht)
              </div>
            </div>
            <div
              className="font-[var(--font-playfair,ui-serif)] text-[2rem] font-semibold"
              style={{ color: "#C8894E" }}
            >
              {formatPrice(cartTotal)}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

