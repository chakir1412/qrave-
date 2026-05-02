import { useCallback, useEffect, useState } from "react";
import { supabase, type RestaurantTable } from "@/lib/supabase";
import type { Bereich, Tisch } from "@/components/dashboard/types";

const TABLES_SELECT =
  "id, restaurant_id, tisch_nummer, bereich, qr_url, nfc_programmiert, nfc_installiert, sticker_angebracht, sticker_installiert, aktiv, created_at";

function defaultEmojiForBereich(bereich: string): string {
  const k = bereich.trim().toLowerCase();
  if (k.includes("terrasse")) return "☀️";
  if (k.includes("bar")) return "🍸";
  if (k.includes("garten")) return "🌿";
  if (k.includes("innen")) return "🏠";
  return "📍";
}

function tableRowToTisch(r: RestaurantTable): Tisch {
  return {
    id: r.id,
    nr: r.tisch_nummer,
    /** Keine Scan-Spalten in restaurant_tables — UI nutzt 0 für Heatmap / „ohne Scan“. */
    scans: 0,
    active: r.aktiv,
  };
}

function rowsToBereiche(rows: RestaurantTable[]): Bereich[] {
  const order: string[] = [];
  const byBereich = new Map<string, RestaurantTable[]>();
  for (const r of rows) {
    const bereich = (r.bereich ?? "").trim() || "Bereich";
    if (!byBereich.has(bereich)) {
      order.push(bereich);
      byBereich.set(bereich, []);
    }
    byBereich.get(bereich)!.push(r);
  }
  return order.map((bereichLabel, idx) => {
    const list = byBereich.get(bereichLabel)!;
    list.sort((a, b) => a.tisch_nummer - b.tisch_nummer);
    const firstId = list[0]?.id ?? `bereich-${idx}`;
    return {
      key: firstId,
      emoji: defaultEmojiForBereich(bereichLabel),
      label: bereichLabel,
      open: idx === 0,
      tische: list.map(tableRowToTisch),
    };
  });
}

export function useRestaurantTables(restaurantId: string) {
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("restaurant_tables")
      .select(TABLES_SELECT)
      .eq("restaurant_id", restaurantId)
      .order("bereich", { ascending: true })
      .order("tisch_nummer", { ascending: true });
    if (err) {
      setError(err.message);
      setBereiche([]);
      setLoading(false);
      return;
    }
    setBereiche(rowsToBereiche((data ?? []) as RestaurantTable[]));
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bereiche, loading, error, refresh };
}
