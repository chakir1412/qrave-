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
};

function fmt(n: number): string {
  return n.toLocaleString("de-DE");
}

export function LineChart({
  data,
  color = "#3b82f6",
  showAvgLine = true,
  showMinMax = true,
  className = "h-[200px] md:h-[280px]",
  emptyLabel = "Keine Daten im Zeitraum.",
}: Props) {
  const W = 1000;
  const H = 200;
  const padBottom = 24;
  const padTop = 12;
  const usableW = W;
  const usableH = H - padBottom - padTop;

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-[10px] border border-dashed text-[12px] ${className}`}
        style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(242,242,242,0.5)" }}
      >
        {emptyLabel}
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  // Y-Domain mit Headroom — Linie klebt nicht am Rand
  const domainTop = max + Math.max(1, Math.ceil(max * 0.1));
  const domainBottom = Math.max(0, min - Math.max(0, Math.ceil(max * 0.05)));
  const span = Math.max(1, domainTop - domainBottom);

  const stepX = data.length > 1 ? usableW / (data.length - 1) : usableW;
  function toY(v: number): number {
    return padTop + (1 - (v - domainBottom) / span) * usableH;
  }
  const points = data.map((d, i) => ({
    x: i * stepX,
    y: toY(d.value),
    value: d.value,
    label: d.label,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const xStep = Math.max(1, Math.ceil(data.length / 5));
  const avgY = toY(avg);

  // Eindeutige Filter-IDs damit mehrere Charts auf derselben Seite nicht
  // gegenseitig den Glow überschreiben.
  const uid = `lc-${Math.abs(hashCode(color + data.length + (data[0]?.label ?? "")))}`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full overflow-visible ${className}`}>
        <defs>
          <filter id={`${uid}-tight`} x="-20%" y="-50%" width="140%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={color} floodOpacity="0.8" />
          </filter>
          <filter id={`${uid}-wide`} x="-20%" y="-50%" width="140%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={color} floodOpacity="0.4" />
          </filter>
        </defs>

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
