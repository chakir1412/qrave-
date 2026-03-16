import type { MenuItem } from "@/lib/supabase";
import { KATEGORIE_EMOJIS } from "./constants";

const NAME_EMOJIS: Record<string, string> = {
  Espresso: "☕",
  Cappuccino: "☕",
  "Flat White": "☕",
  "Espresso Martini": "🍸",
  "Goldene Stunde Spritz": "🥂",
  Hugo: "🥂",
  Negroni: "🥃",
  Mojito: "🍹",
  Weizen: "🍺",
  "Augustiner Hell": "🍺",
  "Craft IPA": "🍺",
  "Fritz Cola": "🥤",
  "Fever Tree Tonic": "🫧",
  Orangensaft: "🍊",
  "Wasser still": "💧",
  Malbec: "🍷",
  Grauburgunder: "🍷",
  "Rosé Provence": "🍷",
  "Veggie Burger": "🥗",
  "Goldene Stunde Burger": "🍔",
};

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(price);
}

export function getItemEmoji(item: MenuItem, kategorie?: string): string {
  if (item.emoji) return item.emoji;
  const name = item.name?.trim() ?? "";
  if (name && NAME_EMOJIS[name]) return NAME_EMOJIS[name];
  const cat = kategorie || item.kategorie?.trim() || "";
  return KATEGORIE_EMOJIS[cat] || "🍴";
}

export function getDisplayPrice(item: MenuItem): string {
  const pv = item.preis_volumen;
  if (pv && typeof pv === "object") {
    const first = pv["g"] ?? pv["m"] ?? pv["l"] ?? pv["btl"];
    if (typeof first === "string") return first;
  }
  return formatPrice(item.preis);
}
