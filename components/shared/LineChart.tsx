/**
 * Revolut-Stil Line-Chart — wiederverwendbar.
 *
 * - Keine Y-Achse, keine Grid-Linien, kein Area-Fill
 * - Linie mit zweistufigem Glow (stdDeviation 3 + 6)
 * - Dezente gestrichelte Durchschnitts-Referenzlinie
 * - Min/Max-Werte als kleine Spans rechts außen
 * - X-Labels unten, max ~5 sichtbar (erste linksbündig, letzte rechtsbündig)
 * - Punkte r=3 mit Glow
 * - Y-Domain mit Headroom (max +10%, min −5%) damit die Linie nicht klebt
 */

type Point = { label: string; value: number };

type Props = {
  data: Point[];
  /** Linien-/Punkt-Farbe und Glow. Default Royal-Blue. */
  color?: string;
  /** Durchschnitts-Referenzlinie anzeigen. Default true. */
  showAvgLine?: boolean;
  /** Min/Max-Werte rechts außerhalb anzeigen. Default true. */
  showMinMax?: boolean;
  /** Tailwind-Klassen für die Container-Höhe (z. B. "h-[200px] md:h-[280px]"). */
  className?: string;
  /** Text wenn `data` leer ist. */
  emptyLabel?: string;
  /** Datenpunkte mit value=0 vor Render filtern. Sinnvoll für Wirt-
   *  Dashboards mit vereinzelten Tagen ohne Scans, damit die Linie nicht
   *  ständig auf Null fällt. Default false. */
  skipZeros?: boolean;
};

function fmt(n: number): string {
  return n.toLocaleString("de-DE");
}

export function LineChart({
  data,
  color = "#9333ea",
  showAvgLine = true,
  showMinMax = true,
  className = "h-[200px] md:h-[280px]",
  emptyLabel = "Keine Daten im Zeitraum.",
  skipZeros = false,
}: Props) {
  const W = 1000;
  const H = 200;
  const padBottom = 24;
  const padTop = 12;
  const usableW = W;
  const usableH = H - padBottom - padTop;

  // Optionales Filtern von Null-Werten BEVOR alles andere berechnet wird.
  const filtered = skipZeros ? data.filter((d) => d.value > 0) : data;

  if (filtered.length < 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-[10px] border border-dashed text-[12px] ${className}`}
        style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(242,242,242,0.5)" }}
      >
        {emptyLabel}
      </div>
    );
  }

  const values = filtered.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  // Y-Domain mit Headroom — Linie klebt nicht am Rand
  const domainTop = max + Math.max(1, Math.ceil(max * 0.1));
  const domainBottom = Math.max(0, min - Math.max(0, Math.ceil(max * 0.05)));
  const span = Math.max(1, domainTop - domainBottom);

  const stepX = filtered.length > 1 ? usableW / (filtered.length - 1) : usableW;
  function toY(v: number): number {
    return padTop + (1 - (v - domainBottom) / span) * usableH;
  }
  const points = filtered.map((d, i) => ({
    x: i * stepX,
    y: toY(d.value),
    value: d.value,
    label: d.label,
  }));

  // Catmull-Rom → Cubic-Bezier-Pfad für sanfte Kurve. Erster Punkt ist
  // der Start (M), für jedes Segment werden zwei Control-Points aus den
  // Nachbarn abgeleitet (Tangente proportional zur Distanz Vorgänger →
  // Nachfolger). Edge-Cases am Anfang/Ende: Control-Point auf den Punkt
  // selbst clampen, damit die Kurve dort ruhig ausläuft.
  function buildSmoothPath(): string {
    const n = points.length;
    if (n === 0) return "";
    if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const linePath = buildSmoothPath();

  const xStep = Math.max(1, Math.ceil(filtered.length / 5));
  const avgY = toY(avg);

  // Y-Achse: 5 Stops aus echten Datenwerten zwischen min und max,
  // gerundet und dedupliziert (bei flachen Reihen können einige
  // Werte zusammenfallen).
  const stopCount = 5;
  const rawStops = Array.from({ length: stopCount }, (_, i) =>
    min + ((max - min) * i) / (stopCount - 1),
  ).map((v) => Math.round(v));
  const yStops = [...new Set(rawStops)].sort((a, b) => b - a);

  // Eindeutige Filter-IDs damit mehrere Charts auf derselben Seite nicht
  // gegenseitig den Glow überschreiben.
  const uid = `lc-${Math.abs(hashCode(color + filtered.length + (filtered[0]?.label ?? "")))}`;

  // Anteil-im-Container für einen Wert (0..100%), nutzt dasselbe Mapping
  // wie das SVG (toY in viewBox-Koordinaten, durch H normalisiert).
  function topPct(v: number): number {
    return (toY(v) / H) * 100;
  }

  // SVG bekommt links Platz für die Y-Labels, damit die Linie nicht durch
  // die Labels läuft. ~32px = genug für 4 Ziffern + Margin.
  const Y_LABEL_WIDTH = 32;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Y-Achse: Labels links außerhalb des Chart-Bereichs */}
      <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: Y_LABEL_WIDTH }}>
        {yStops.map((v) => (
          <span
            key={`y-${v}`}
            className="absolute text-[11px]"
            style={{
              right: 6,
              top: `${topPct(v)}%`,
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {fmt(v)}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full overflow-visible"
        style={{ left: Y_LABEL_WIDTH, width: `calc(100% - ${Y_LABEL_WIDTH}px)` }}
      >
        <defs>
          <filter id={`${uid}-tight`} x="-20%" y="-50%" width="140%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={color} floodOpacity="0.8" />
          </filter>
          <filter id={`${uid}-wide`} x="-20%" y="-50%" width="140%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={color} floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Horizontale Grid-Linien — eine pro Y-Stop */}
        {yStops.map((v) => {
          const y = toY(v);
          return (
            <line
              key={`grid-${v}`}
              x1="0"
              y1={y}
              x2={W}
              y2={y}
              stroke="#ffffff"
              strokeOpacity="0.06"
              strokeWidth="1"
            />
          );
        })}

        {showAvgLine ? (
          <line
            x1="0"
            y1={avgY}
            x2={W}
            y2={avgY}
            stroke="#ffffff"
            strokeOpacity="0.15"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ) : null}

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${uid}-wide)`}
        />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${uid}-tight)`}
        />

        {points.map((p, i) => (
          <circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            filter={`url(#${uid}-tight)`}
          />
        ))}

        {points.map((p, i) => {
          if (i % xStep !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={`x-${i}`}
              x={p.x}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="11"
              fill="rgba(242,242,242,0.5)"
              fontFamily="DM Sans"
            >
              {p.label}
            </text>
          );
        })}
      </svg>

      {showMinMax ? (
        <>
          <span
            className="pointer-events-none absolute right-0 top-0 text-[11px]"
            style={{ color: "rgba(242,242,242,0.5)" }}
          >
            {fmt(max)}
          </span>
          <span
            className="pointer-events-none absolute bottom-[26px] right-0 text-[11px]"
            style={{ color: "rgba(242,242,242,0.5)" }}
          >
            {fmt(min)}
          </span>
        </>
      ) : null}
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
