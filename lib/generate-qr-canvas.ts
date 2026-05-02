"use client";

import { create } from "qrcode";
import type { BitMatrix, QRCode } from "qrcode";

const PAD = 16;
const MODULE_COLOR = "#000000";
const BG = "#ffffff";
const FALLBACK_Q = "#FF5C1A";
/** Weißer Logo-Hintergrund: Durchmesser ≈ 28 % der QR-Innenbreite */
const LOGO_DIAMETER_RATIO = 0.28;

function isFinderRegion(row: number, col: number, n: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= n - 7) return true;
  if (row >= n - 7 && col < 7) return true;
  return false;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawFinder(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellSize: number,
): void {
  const s = cellSize;
  ctx.fillStyle = MODULE_COLOR;
  roundRect(ctx, px, py, 7 * s, 7 * s, s * 1.5);
  ctx.fill();

  ctx.fillStyle = BG;
  roundRect(ctx, px + s, py + s, 5 * s, 5 * s, s);
  ctx.fill();

  ctx.fillStyle = MODULE_COLOR;
  roundRect(ctx, px + 2 * s, py + 2 * s, 3 * s, 3 * s, s * 0.8);
  ctx.fill();
}

function drawDataDots(
  ctx: CanvasRenderingContext2D,
  modules: BitMatrix,
  pad: number,
  cell: number,
  n: number,
): void {
  ctx.fillStyle = MODULE_COLOR;
  const r = cell * 0.45;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (isFinderRegion(row, col, n)) continue;
      if (modules.get(row, col) === 0) continue;
      const x = pad + col * cell;
      const y = pad + row * cell;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFinderPatterns(ctx: CanvasRenderingContext2D, pad: number, cell: number, n: number): void {
  drawFinder(ctx, pad + 0 * cell, pad + 0 * cell, cell);
  drawFinder(ctx, pad + (n - 7) * cell, pad + 0 * cell, cell);
  drawFinder(ctx, pad + 0 * cell, pad + (n - 7) * cell, cell);
}

function loadImageCors(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadRestaurantLogoWithFallback(logoUrl: string): Promise<HTMLImageElement | null> {
  const primary = logoUrl.trim();
  const first = await loadImageCors(primary);
  if (first) return first;
  if (primary.endsWith("/logo.png")) {
    return loadImageCors(primary.slice(0, -4));
  }
  return null;
}

async function drawLogoCenter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerSize: number,
  logoUrl: string | null,
): Promise<void> {
  const d = innerSize * LOGO_DIAMETER_RATIO;
  const r = d / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
  ctx.clip();

  if (logoUrl?.trim()) {
    const img = await loadRestaurantLogoWithFallback(logoUrl);
    if (img && img.naturalWidth > 0) {
      const max = d * 0.82;
      let iw = img.naturalWidth;
      let ih = img.naturalHeight;
      const scale = Math.min(max / iw, max / ih);
      iw *= scale;
      ih *= scale;
      ctx.drawImage(img, centerX - iw / 2, centerY - ih / 2, iw, ih);
      ctx.restore();
      return;
    }
  }

  ctx.fillStyle = FALLBACK_Q;
  ctx.font = `800 ${r * 1.35}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Q", centerX, centerY);
  ctx.restore();
}

export type GenerateQrCanvasOptions = {
  /** Gesamtbreite/-höhe in Pixel inkl. 16px Rand */
  size?: number;
};

/**
 * Qrave QR: runde Finder-Pattern, runde Datenpunkte, Logo in der Mitte.
 * Nur im Browser verwenden (Canvas + Image).
 */
export async function generateQrCanvas(
  url: string,
  logoUrl: string | null,
  size = 400,
): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined") {
    throw new Error("generateQrCanvas nur im Browser");
  }

  const qr: QRCode = create(url, { errorCorrectionLevel: "H" });
  const modules = qr.modules;
  const n = modules.size;
  const outer = Math.max(size, PAD * 2 + 21);
  const inner = outer - PAD * 2;
  const cell = inner / n;

  const canvas = document.createElement("canvas");
  const dpr =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio || 2
      : 2;
  canvas.width = Math.round(outer * dpr);
  canvas.height = Math.round(outer * dpr);
  canvas.style.width = `${outer}px`;
  canvas.style.height = `${outer}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D nicht verfügbar");
  }
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, outer, outer);

  drawFinderPatterns(ctx, PAD, cell, n);
  drawDataDots(ctx, modules, PAD, cell, n);

  const cx = PAD + inner / 2;
  const cy = PAD + inner / 2;
  await drawLogoCenter(ctx, cx, cy, inner, logoUrl);

  return canvas;
}

export async function generateQrPngDataUrl(
  url: string,
  logoUrl: string | null,
  size = 400,
): Promise<string> {
  const canvas = await generateQrCanvas(url, logoUrl, size);
  return canvas.toDataURL("image/png", 1.0);
}

export function downloadQrPng(filenameBase: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${filenameBase}.png`;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
