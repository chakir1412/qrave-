/** Extrahiert die dominante Akzentfarbe aus einem Logo-Image-URL.
 *  Client-only — nutzt Canvas-Sampling.
 *
 *  Strategie: ein 64×64-Sample des Bildes, alle Pixel im
 *  HSL-Lightness-Band 20%–80% (also weder fast-schwarz noch fast-weiß)
 *  grob in 32er-Buckets quantisieren, häufigster Bucket gewinnt.
 *
 *  So funktioniert das auch bei Logos mit dunklem Hintergrund + heller
 *  CI-Farbe (z. B. weiße Schrift auf dunkelgrün): der dunkle Hintergrund
 *  fällt unter die 20%-Schwelle, die CI-Farbe wird gefunden, anstatt dass
 *  der dominante schwarze/weiße Anteil das Ergebnis verzerrt.
 *
 *  Optional Saturation-Floor 0.08 filtert reines Grau. Liefert Hex
 *  wie `#c9a84c`. Bei Fehler/Fallback: `null`. */
export async function extractAccentColorFromImage(
  src: string,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 128) continue; // transparente Pixel skippen

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // HSL-Lightness in [0, 1].
      const lightness = (max + min) / (2 * 255);
      // 20%–80% Band: filtert fast-schwarz UND fast-weiß heraus.
      if (lightness < 0.2 || lightness > 0.8) continue;
      // Reines Grau (sehr niedrige Saturation) auch ausschließen — sonst
      // gewinnt bei farbarmen Logos eine graue Mittelton-Fläche.
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (saturation < 0.08) continue;

      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.count += 1;
      buckets.set(key, cur);
    }

    if (buckets.size === 0) return null;

    let best: { r: number; g: number; b: number; count: number } | null = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.count > best.count) best = bucket;
    }
    if (!best) return null;

    const r = Math.round(best.r / best.count);
    const g = Math.round(best.g / best.count);
    const b = Math.round(best.b / best.count);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
