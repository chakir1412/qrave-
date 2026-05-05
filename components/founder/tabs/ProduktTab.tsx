"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
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

type BrandGroup = {
  /** Lowercase Brand-Key (z.B. "fritz-kola") */
  key: string;
  /** Anzeigename (z.B. "Fritz-Kola") */
  displayName: string;
  occurrences: ProductRow[];
  /** Eindeutige Restaurant-IDs */
  restaurantCount: number;
};

type Props = {
  isMobile: boolean;
};

/** Bekannte Marken (Pattern → kanonischer Name).
 * Reihenfolge ist relevant: spezifischere Patterns zuerst,
 * damit "Coca-Cola" nicht von einem allgemeinen "Cola"-Pattern eingefangen wird. */
const BRAND_PATTERNS: ReadonlyArray<{ pattern: RegExp; canonical: string }> = [
  { pattern: /fritz[\s-]?(kola|cola)/i, canonical: "Fritz-Kola" },
  { pattern: /coca[\s-]?cola|coke\b/i, canonical: "Coca-Cola" },
  { pattern: /pepsi/i, canonical: "Pepsi" },
  { pattern: /\bfanta\b/i, canonical: "Fanta" },
  { pattern: /\bsprite\b/i, canonical: "Sprite" },
  { pattern: /spezi|mezzo[\s-]?mix/i, canonical: "Spezi" },
  { pattern: /\bschwip\s?schwap\b/i, canonical: "Schwip Schwap" },
  { pattern: /selters/i, canonical: "Selters" },
  { pattern: /gerolsteiner/i, canonical: "Gerolsteiner" },
  { pattern: /vöslauer|voslauer/i, canonical: "Vöslauer" },
  { pattern: /adelholzener/i, canonical: "Adelholzener" },
  { pattern: /apfelschorle/i, canonical: "Apfelschorle" },
  { pattern: /apfelsaft/i, canonical: "Apfelsaft" },
  { pattern: /orangensaft|\bo[\s-]?saft\b/i, canonical: "Orangensaft" },
  { pattern: /\bredbull|red[\s-]?bull/i, canonical: "Red Bull" },
  { pattern: /club[\s-]?mate|mate\b/i, canonical: "Club-Mate" },
  { pattern: /bitburger/i, canonical: "Bitburger" },
  { pattern: /krombacher/i, canonical: "Krombacher" },
  { pattern: /becks?\b|beck'?s/i, canonical: "Beck's" },
  { pattern: /warsteiner/i, canonical: "Warsteiner" },
  { pattern: /paulaner/i, canonical: "Paulaner" },
  { pattern: /augustiner/i, canonical: "Augustiner" },
  { pattern: /erdinger/i, canonical: "Erdinger" },
  { pattern: /schöfferhofer|schoefferhofer|schoefferhof/i, canonical: "Schöfferhofer" },
  { pattern: /hövels|hoevels/i, canonical: "Hövels" },
  { pattern: /henninger/i, canonical: "Henninger" },
  { pattern: /jever/i, canonical: "Jever" },
  { pattern: /tegernseer/i, canonical: "Tegernseer" },
  { pattern: /franziskaner/i, canonical: "Franziskaner" },
  { pattern: /aperol/i, canonical: "Aperol" },
  { pattern: /campari/i, canonical: "Campari" },
  { pattern: /\bhugo\b/i, canonical: "Hugo" },
  { pattern: /lillet/i, canonical: "Lillet" },
  { pattern: /martini\b/i, canonical: "Martini" },
  { pattern: /jägermeister|jagermeister/i, canonical: "Jägermeister" },
  { pattern: /apfelwein|ebbelwoi|äppler|appler/i, canonical: "Apfelwein" },
  { pattern: /espresso\b/i, canonical: "Espresso" },
  { pattern: /cappuccino\b/i, canonical: "Cappuccino" },
  { pattern: /latte[\s-]?macchiato/i, canonical: "Latte Macchiato" },
  { pattern: /\bkaffee\b/i, canonical: "Kaffee" },
  { pattern: /\btee\b/i, canonical: "Tee" },
];

/** Normalisierungs-Helfer für unbekannte Items: Bindestriche, Mehrfach-Spaces,
 *  Volumen-/Mengenangaben raus. So sammeln wir "Pils 0,3l" und "Pils 0,5l"
 *  unter dem gleichen Brand-Key. */
function fallbackNormalize(name: string): string {
  let s = name.toLowerCase().trim();
  // Volumenangaben weg: 0,3l / 0.5 l / 200ml / 1/4 / 0,2l
  s = s.replace(/\b\d+[.,]?\d*\s?(l|ml|cl)\b/g, "");
  s = s.replace(/\b\d+\s?\/\s?\d+\b/g, "");
  s = s.replace(/\b(klein|gross|groß|mittel|piccolo|grande)\b/g, "");
  s = s.replace(/[()[\]]/g, "");
  s = s.replace(/[-–—_]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function classifyBrand(itemName: string): { key: string; displayName: string } {
  for (const { pattern, canonical } of BRAND_PATTERNS) {
    if (pattern.test(itemName)) {
      return { key: canonical.toLowerCase(), displayName: canonical };
    }
  }
  const norm = fallbackNormalize(itemName);
  if (!norm) {
    return { key: itemName.trim().toLowerCase(), displayName: itemName.trim() };
  }
  // Fallback: ersten Buchstaben groß für Display
  const display = norm.charAt(0).toUpperCase() + norm.slice(1);
  return { key: norm, displayName: display };
}

function groupByBrand(rows: ProductRow[]): BrandGroup[] {
  const map = new Map<string, BrandGroup>();
  for (const r of rows) {
    const { key, displayName } = classifyBrand(r.itemName);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.occurrences.push(r);
    } else {
      map.set(key, {
        key,
        displayName,
        occurrences: [r],
        restaurantCount: 0,
      });
    }
  }
  // restaurantCount = eindeutige restaurant_ids pro Marke
  for (const g of map.values()) {
    const ids = new Set(g.occurrences.map((o) => o.restaurantId));
    g.restaurantCount = ids.size;
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.restaurantCount !== a.restaurantCount) return b.restaurantCount - a.restaurantCount;
    return a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" });
  });
}

export function ProduktTab({ isMobile }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [openBrand, setOpenBrand] = useState<string | null>(null);

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

  const brands = useMemo(() => groupByBrand(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((g) => g.displayName.toLowerCase().includes(q));
  }, [brands, query]);

  const totalBrands = brands.length;
  const totalRestaurants = useMemo(() => {
    const set = new Set(rows.map((r) => r.restaurantId));
    return set.size;
  }, [rows]);

  return (
    <section className="founder-card" style={{ padding: 16 }}>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Marken-Übersicht</h2>
        <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          Welche Marken werden über die {totalRestaurants} Restaurants geführt — sortiert nach Reichweite. Klick auf eine Marke zeigt die Restaurants.
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
          placeholder='Marke suchen — z. B. "Fritz-Kola"'
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
            {filtered.length} von {totalBrands} Marken
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((g) => {
              const isOpen = openBrand === g.key;
              const restaurantsForBrand = (() => {
                const map = new Map<string, { name: string; slug: string; count: number }>();
                for (const o of g.occurrences) {
                  const cur = map.get(o.restaurantId) ?? { name: o.restaurantName, slug: o.restaurantSlug, count: 0 };
                  cur.count += 1;
                  map.set(o.restaurantId, cur);
                }
                return [...map.entries()]
                  .map(([id, v]) => ({ id, ...v }))
                  .sort((a, b) => a.name.localeCompare(b.name, "de"));
              })();
              return (
                <li
                  key={g.key}
                  style={{
                    padding: 0,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenBrand((prev) => (prev === g.key ? null : g.key))}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#fff",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{g.displayName}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                        {g.restaurantCount} Restaurant{g.restaurantCount === 1 ? "" : "s"} · {g.occurrences.length} Eintrag
                        {g.occurrences.length === 1 ? "" : "e"}
                      </span>
                    </div>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#34e89e",
                          background: "rgba(52,232,158,0.12)",
                          border: "1px solid rgba(52,232,158,0.25)",
                          borderRadius: 999,
                          padding: "3px 10px",
                          minWidth: 32,
                          textAlign: "center",
                        }}
                      >
                        {g.restaurantCount}
                      </span>
                      <ChevronDown
                        size={14}
                        color="rgba(255,255,255,0.5)"
                        style={{
                          transition: "transform 200ms",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </span>
                  </button>
                  {isOpen ? (
                    <div
                      style={{
                        padding: "8px 12px 12px",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        background: "rgba(255,255,255,0.015)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: isMobile ? "column" : "row",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        {restaurantsForBrand.map((r) => (
                          <a
                            key={r.id}
                            href={`/${r.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              background: "rgba(0,200,160,0.08)",
                              border: "1px solid rgba(0,200,160,0.22)",
                              color: "#34e89e",
                              borderRadius: 999,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.name}
                            {r.count > 1 ? (
                              <span style={{ marginLeft: 6, opacity: 0.65 }}>×{r.count}</span>
                            ) : null}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, padding: "8px 0" }}>
                Keine Marke passt zur Suche „{query}".
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}
