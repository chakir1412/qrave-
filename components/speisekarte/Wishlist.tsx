"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import { formatPrice, getItemEmoji, getDisplayPrice } from "./utils";
import PresentationMode from "./PresentationMode";

type CartItem = { item: MenuItem; qty: number };

const barSoleilWishlist = {
  bg: "#1C1914",
  text: "#F0EBE3",
  muted: "#8A7E70",
  copper: "#C8894E",
  buttonBg: "#2C2820",
  border: "rgba(255,255,255,0.1)",
};

type WishlistProps = {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (itemId: string, delta: number) => void;
  onRemove: (itemId: string) => void;
  cartTotal: number;
  onClear: () => void;
  restaurantName?: string;
  /** Overlay z-index (z. B. 999 wenn Bottom-Nav darüber liegen soll) */
  overlayZIndex?: number;
  theme?: "light" | "bar-soleil";
};

export default function Wishlist({
  open,
  onClose,
  cart,
  onUpdateQty,
  onRemove,
  cartTotal,
  onClear,
  restaurantName,
  overlayZIndex = 500,
  theme = "light",
}: WishlistProps) {
  const dark = theme === "bar-soleil";
  const [presentOpen, setPresentOpen] = useState(false);
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        style={{ zIndex: overlayZIndex }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-[480px] max-h-[84vh] rounded-t-3xl flex flex-col border-t animate-[slideUp_0.28s_ease]"
          style={{
            backgroundColor: dark ? barSoleilWishlist.bg : "white",
            borderColor: dark ? barSoleilWishlist.border : "#e8e4dc",
          }}
          onClick={(e) => e.stopPropagation()}
        >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: dark ? barSoleilWishlist.border : "#e8e4dc" }}
        >
          <h3 className="font-serif text-[1.3rem] font-normal" style={{ color: dark ? barSoleilWishlist.text : "#1a1916" }}>
            Meine Liste
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: dark ? barSoleilWishlist.buttonBg : "#f5f4f0",
              border: `1px solid ${dark ? barSoleilWishlist.border : "#e8e4dc"}`,
              color: dark ? barSoleilWishlist.text : "#9a948a",
            }}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center py-8" style={{ color: dark ? barSoleilWishlist.muted : "#9a948a" }}>
              <div className="text-[2.2rem] mb-2">🛒</div>
              <div className="text-[0.84rem]">Deine Liste ist leer.</div>
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map(({ item, qty }) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 py-2 border-b last:border-0"
                  style={{ borderColor: dark ? barSoleilWishlist.border : "#f0ece5" }}
                >
                  <span className="text-[1.6rem]">{getItemEmoji(item)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[0.84rem]" style={{ color: dark ? barSoleilWishlist.text : "#1a1916" }}>
                      {item.name}
                    </div>
                    <div className="text-[0.73rem]" style={{ color: dark ? barSoleilWishlist.text : "#b8966a" }}>
                      {getDisplayPrice(item)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={{
                        backgroundColor: dark ? barSoleilWishlist.buttonBg : "#f5f4f0",
                        border: `1px solid ${dark ? barSoleilWishlist.border : "#e8e4dc"}`,
                        color: dark ? barSoleilWishlist.text : "#1a1916",
                      }}
                    >
                      −
                    </button>
                    <span className="text-[0.82rem] font-semibold min-w-[16px] text-center" style={{ color: dark ? barSoleilWishlist.text : "#1a1916" }}>
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={{
                        backgroundColor: dark ? barSoleilWishlist.buttonBg : "#f5f4f0",
                        border: `1px solid ${dark ? barSoleilWishlist.border : "#e8e4dc"}`,
                        color: dark ? barSoleilWishlist.text : "#1a1916",
                      }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="p-1"
                    style={{ color: dark ? barSoleilWishlist.copper : "#9a948a" }}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
          {cart.length > 0 && (
            <div className="p-4 border-t" style={{ borderColor: dark ? barSoleilWishlist.border : "#e8e4dc" }}>
              <div className="flex justify-between font-semibold text-[0.9rem] mb-2" style={{ color: dark ? barSoleilWishlist.text : "#1a1916" }}>
                <span>Gesamt (ca.)</span>
                <span className="font-serif text-[1.1rem]" style={{ color: dark ? barSoleilWishlist.text : "#b8966a" }}>
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <button
                type="button"
                className="w-full py-3 rounded-xl font-semibold text-[0.84rem] mb-2"
                style={{
                  backgroundColor: dark ? barSoleilWishlist.copper : "#1a1916",
                  color: "#fff",
                }}
                onClick={() => setPresentOpen(true)}
              >
                📋 Kellner zeigen
              </button>
              <button
                type="button"
                onClick={onClear}
                className="w-full py-2 rounded-xl border text-[0.73rem]"
                style={{
                  borderColor: dark ? barSoleilWishlist.border : "#e8e4dc",
                  color: dark ? barSoleilWishlist.muted : "#9a948a",
                  backgroundColor: dark ? barSoleilWishlist.buttonBg : "transparent",
                }}
              >
                Liste leeren
              </button>
            </div>
          )}
        </div>
      </div>

      <PresentationMode
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        restaurantName={restaurantName ?? "Ihre Bestellung"}
        cart={cart}
        cartTotal={cartTotal}
      />
    </>
  );
}
