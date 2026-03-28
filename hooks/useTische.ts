import { useCallback, useEffect, useState } from "react";
import { supabase, type RestaurantTable } from "@/lib/supabase";
import type { Bereich, Tisch } from "@/components/dashboard/types";

const TABLES_SELECT =
  "id, restaurant_id, tisch_nummer, zone, qr_code_url, nfc_aktiv, aktiv, created_at";

function defaultEmojiForZone(zone: string): string {
  const k = zone.trim().toLowerCase();
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
    /** Keine Scan-Spalten in der DB — UI nutzt 0 für Heatmap / „ohne Scan“. */
    scans: 0,
    active: r.aktiv,
  };
}

function rowsToBereiche(rows: RestaurantTable[]): Bereich[] {
  const order: string[] = [];
  const byZone = new Map<string, RestaurantTable[]>();
  for (const r of rows) {
    const zone = r.zone.trim() || "Bereich";
    if (!byZone.has(zone)) {
      order.push(zone);
      byZone.set(zone, []);
    }
    byZone.get(zone)!.push(r);
  }
  return order.map((zoneLabel, idx) => {
    const list = byZone.get(zoneLabel)!;
    list.sort((a, b) => a.tisch_nummer - b.tisch_nummer);
    const firstId = list[0]?.id ?? `zone-${idx}`;
    return {
      key: firstId,
      emoji: defaultEmojiForZone(zoneLabel),
      label: zoneLabel,
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
      .from("tables")
      .select(TABLES_SELECT)
      .eq("restaurant_id", restaurantId)
      .order("zone", { ascending: true })
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
