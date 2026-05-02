"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  itemId: string;
  itemName: string;
  kategorie: string;
  preis: number;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
};

type ProductGroup = {
  /** Lowercase trimmed key, dient als group identifier */
  key: string;
  displayName: string;
  occurrences: ProductRow[];
};

type Props = {
  isMobile: boolean;
};

function groupByName(rows: ProductRow[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const r of rows) {
    const key = r.itemName.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.occurrences.push(r);
    } else {
      map.set(key, {
        key,
        displayName: r.itemName.trim(),
        occurrences: [r],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" }),
  );
}

export function ProduktTab({ isMobile }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("menu_items")
        .select(
          "id, name, kategorie, preis, aktiv, restaurant_id, restaurants:restaurant_id(id, name, slug)",
        )
        .eq("aktiv", true);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRows([]);
        setLoading(false);
        return;
      }
      type RawRow = {
        id: string;
        name: string;
        kategorie: string | null;
        preis: number | null;
        restaurant_id: string;
        restaurants: { id: string; name: string; slug: string } | null;
      };
      const list = (data ?? []) as unknown as RawRow[];
      const mapped: ProductRow[] = list
        .filter((r) => r.restaurants)
        .map((r) => ({
          itemId: r.id,
          itemName: r.name,
          kategorie: r.kategorie ?? "—",
          preis: typeof r.preis === "number" ? r.preis : 0,
          restaurantId: r.restaurants!.id,
          restaurantName: r.restaurants!.name,
          restaurantSlug: r.restaurants!.slug,
        }));
      setRows(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupByName(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.displayName.toLowerCase().includes(q));
  }, [groups, query]);

  const totalProducts = groups.length;
  const totalRestaurants = useMemo(() => {
    const set = new Set(rows.map((r) => r.restaurantId));
    return set.size;
  }, [rows]);

  return (
    <section className="founder-card" style={{ padding: 16 }}>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Produkt-Übersicht</h2>
        <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          Alle Produkte über alle {totalRestaurants} Restaurants — gedacht für Sponsored-Targeting.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          marginBottom: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
        }}
      >
        <Search size={16} color="rgba(255,255,255,0.5)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Produkt suchen — z. B. "Fritz-Kola"'
          className="bg-transparent"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#fff",
            fontSize: 14,
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        ) : null}
      </div>

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>Lade Produkte…</p>
      ) : error ? (
        <p style={{ color: "#ff4b6e", fontSize: 13 }}>Fehler: {error}</p>
      ) : (
        <>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {filtered.length} von {totalProducts} einzigartigen Produkten
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((g) => (
              <li
                key={g.key}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    justifyContent: "space-between",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 6,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{g.displayName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      In {g.occurrences.length} Restaurant{g.occurrences.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      maxWidth: isMobile ? "100%" : "60%",
                    }}
                  >
                    {g.occurrences.map((o) => (
                      <a
                        key={`${o.itemId}-${o.restaurantId}`}
                        href={`/${o.restaurantSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${o.kategorie} · ${o.preis.toFixed(2)} €`}
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          background: "rgba(0,200,160,0.08)",
                          border: "1px solid rgba(0,200,160,0.22)",
                          color: "#34e89e",
                          borderRadius: 999,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.restaurantName}
                      </a>
                    ))}
                  </div>
                </div>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, padding: "8px 0" }}>
                Kein Produkt passt zur Suche „{query}".
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}
