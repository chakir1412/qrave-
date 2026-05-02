/**
 * PDF-Verarbeitung nur für Node (API Route). Gescannte PDFs → PNG-Base64 für Anthropic.
 */
import { createCanvas } from "canvas";
import path from "path";
import { pathToFileURL } from "url";

const MAX_PAGES_SCAN = 4;
/** Unterhalb: als „gescannt“ behandeln → Seiten rendern. */
export const MIN_TEXT_CHARS_TEXT_PATH = 80;
const MAX_CANVAS_EDGE_PX = 2048;
const BASE_SCALE = 1.75;

let workerConfigured = false;

async function ensurePdfWorker(): Promise<void> {
  if (workerConfigured) return;
  const { GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerSrc = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  GlobalWorkerOptions.workerSrc = pathToFileURL(workerSrc).href;
  workerConfigured = true;
}

/** Extrahiert Fließtext (wie im Browser mit getTextContent). */
export async function extractPdfTextFromBuffer(buf: Buffer): Promise<string> {
  await ensurePdfWorker();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buf);
  const pdf = await getDocument({ data }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) fullText += `${pageText}\n`;
  }
  return fullText;
}

/**
 * Rendert bis zu `maxPages` Seiten als PNG (base64 ohne data:-Prefix).
 */
export async function pdfBufferToPngBase64Pages(
  buf: Buffer,
  maxPages: number = MAX_PAGES_SCAN,
): Promise<string[]> {
  await ensurePdfWorker();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buf);
  const pdf = await getDocument({ data }).promise;
  const images: string[] = [];
  const num = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= num; i++) {
    const page = await pdf.getPage(i);
    const baseVp = page.getViewport({ scale: 1 });
    let scale = BASE_SCALE;
    const targetW = baseVp.width * scale;
    if (targetW > MAX_CANVAS_EDGE_PX) {
      scale = MAX_CANVAS_EDGE_PX / baseVp.width;
    }
    const viewport = page.getViewport({ scale });
    const w = Math.max(1, Math.floor(viewport.width));
    const h = Math.max(1, Math.floor(viewport.height));
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context nicht verfügbar.");

    await page.render({
      canvasContext: ctx as never,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise;

    const pngBuf = canvas.toBuffer("image/png");
    images.push(pngBuf.toString("base64"));
  }

  return images;
}
