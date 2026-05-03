"use client";

import { generateQrPngDataUrl } from "@/lib/generate-qr-canvas";

const PER_PAGE = 12; // 4 × 3
const STICKER_MM = 50;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filenameSafe(slug: string): string {
  const t = slug.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return t.length > 0 ? t : "restaurant";
}

export type StickerTable = {
  /** Tisch-Nummer */
  tisch_nummer: number;
  /** Optional vorberechnete URL (sonst aus slug + nummer) */
  qr_url?: string | null;
};

/**
 * Erzeugt eine HTML-Datei im Sticker-Bogen-Layout (4 × 3 = 12 Sticker pro
 * A4-Seite, 50 × 50 mm pro Sticker, weiß / schwarz, druckfertig) und
 * triggert den Download. Der Operator öffnet die Datei und druckt sie als
 * PDF (Cmd/Strg + P → "Als PDF speichern").
 */
export async function downloadStickerSheetHtml(
  restaurantName: string,
  slug: string,
  tables: StickerTable[],
  logoUrl: string | null,
): Promise<void> {
  const sorted = [...tables].sort((a, b) => a.tisch_nummer - b.tisch_nummer);
  if (sorted.length === 0) return;

  const items: Array<{ dataUrl: string; nummer: number; url: string }> = [];
  for (const t of sorted) {
    const url = t.qr_url ?? `https://qrave.menu/${slug}/tisch-${t.tisch_nummer}`;
    const dataUrl = await generateQrPngDataUrl(url, logoUrl, 320);
    items.push({ dataUrl, nummer: t.tisch_nummer, url });
  }

  const pages: Array<typeof items> = [];
  for (let i = 0; i < items.length; i += PER_PAGE) {
    pages.push(items.slice(i, i + PER_PAGE));
  }

  const cellHtml = (it: (typeof items)[number]): string => `
    <div class="cell">
      <img src="${it.dataUrl}" alt="" />
      <div class="label">Tisch ${it.nummer}</div>
      <div class="brand">${escapeHtml(restaurantName)}</div>
    </div>`;

  const pagesHtml = pages
    .map((chunk) => `<section class="sheet"><div class="grid">${chunk.map(cellHtml).join("")}</div></section>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>QR-Sticker · ${escapeHtml(restaurantName)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    @page { size: A4 portrait; margin: 12mm; }
    .sheet {
      page-break-after: always;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .sheet:last-child { page-break-after: auto; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, ${STICKER_MM}mm);
      grid-auto-rows: ${STICKER_MM}mm;
      gap: 4mm;
    }
    .cell {
      width: ${STICKER_MM}mm;
      height: ${STICKER_MM}mm;
      padding: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      background: #fff;
      color: #000;
      border: 0.4pt solid #000;
      border-radius: 2mm;
      break-inside: avoid;
    }
    .cell img {
      display: block;
      width: 32mm;
      height: 32mm;
      margin-top: 1mm;
    }
    .label {
      font-size: 10pt;
      font-weight: 700;
      margin-top: 1.5mm;
      letter-spacing: 0.02em;
    }
    .brand {
      font-size: 6.5pt;
      margin-top: 0.5mm;
      color: #000;
      max-width: 46mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: 0.04em;
    }
    .meta {
      padding: 6mm 12mm 4mm;
      font-size: 9pt;
      color: #555;
    }
    @media print {
      .meta { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="meta">${escapeHtml(restaurantName)} · ${items.length} QR-Sticker · 4 × 3 pro A4-Seite (50 × 50 mm) · Cmd/Strg + P → „Als PDF speichern"</div>
  ${pagesHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `qrave-${filenameSafe(slug)}-sticker.html`;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
