import type { FounderRestaurantTableRow } from "@/lib/founder-types";

const PER_PAGE = 6;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Öffnet ein neues Fenster mit druckfertigem A4-Layout (6 QR-Codes pro Seite) und ruft danach `print()` auf.
 */
export async function openRestaurantQrPrintWindow(
  restaurantName: string,
  slug: string,
  tables: FounderRestaurantTableRow[],
): Promise<void> {
  const QRCode = (await import("qrcode")).default;
  const sorted = [...tables].sort((a, b) => a.tisch_nummer - b.tisch_nummer);
  if (sorted.length === 0) {
    return;
  }

  const items: { dataUrl: string; nummer: number; bereich: string; url: string }[] = [];
  for (const t of sorted) {
    const url = t.qr_url ?? `https://qrave.menu/${slug}/tisch-${t.tisch_nummer}`;
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" });
    items.push({
      dataUrl,
      nummer: t.tisch_nummer,
      bereich: t.bereich?.trim() ? t.bereich.trim() : "Ohne Bereich",
      url,
    });
  }

  const pages: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) {
    pages.push(items.slice(i, i + PER_PAGE));
  }

  const pageHtml = pages
    .map((chunk) => {
      const cells = chunk
        .map(
          (it) => `
        <div class="cell">
          <img src="${it.dataUrl}" alt="" width="200" height="200" />
          <div class="meta">
            <div class="titel">Tisch ${it.nummer}</div>
            <div class="sub">${escapeHtml(it.bereich)}</div>
            <div class="url">${escapeHtml(it.url)}</div>
          </div>
        </div>`,
        )
        .join("");
      return `<section class="sheet"><div class="grid6">${cells}</div></section>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>QR-Codes · ${escapeHtml(restaurantName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #fff; color: #111; }
    @page { size: A4; margin: 14mm; }
    .sheet {
      page-break-after: always;
      min-height: 268mm;
      padding: 0;
    }
    .sheet:last-child { page-break-after: auto; }
    .grid6 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(3, 1fr);
      gap: 10mm;
      align-content: start;
    }
    .cell {
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 8mm;
      text-align: center;
      break-inside: avoid;
    }
    .cell img { display: block; margin: 0 auto 4mm; }
    .meta { font-size: 11px; line-height: 1.35; }
    .titel { font-weight: 800; font-size: 14px; margin-bottom: 2px; }
    .sub { color: #555; margin-bottom: 4px; }
    .url { font-family: ui-monospace, monospace; font-size: 9px; color: #888; word-break: break-all; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1 style="font-size:16px;margin:8mm 14mm 0;">${escapeHtml(restaurantName)}</h1>
  <p style="font-size:11px;color:#666;margin:4px 14mm 8mm;">QRave · Speisekarte scannen</p>
  ${pageHtml}
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
