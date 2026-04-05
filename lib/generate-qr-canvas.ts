"use client";

import { create } from "qrcode";
import type { BitMatrix, QRCode } from "qrcode";

const PAD = 16;
const MODULE_COLOR = "#1a1a1a";
const BG = "#ffffff";
const FALLBACK_Q = "#FF5C1A";
/** Weißer Logo-Hintergrund: Durchmesser ≈ 22 % der QR-Innenbreite */
const LOGO_DIAMETER_RATIO = 0.22;

function isFinderRegion(row: number, col: number, n: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= n - 7) return true;
  if (row >= n - 7 && col < 7) return true;
  return false;
}

function fillRoundRect(
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
  ctx.fill();
}

function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cell: number,
  color: string,
): void {
  const w = 7 * cell;
  ctx.fillStyle = color;
  fillRoundRect(ctx, px, py, w, w, 2.15 * cell);
  ctx.fillStyle = BG;
  fillRoundRect(ctx, px + cell, py + cell, 5 * cell, 5 * cell, 1.35 * cell);
  ctx.fillStyle = color;
  fillRoundRect(ctx, px + 2 * cell, py + 2 * cell, 3 * cell, 3 * cell, 0.85 * cell);
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

function drawDataModules(
  ctx: CanvasRenderingContext2D,
  modules: BitMatrix,
  pad: number,
  cell: number,
  n: number,
): void {
  const gap = cell * 0.06;
  const w = cell - 2 * gap;
  const cornerR = Math.max(cell * 0.32, 0.5);
  ctx.fillStyle = MODULE_COLOR;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isFinderRegion(r, c, n)) continue;
      if (!modules.get(r, c)) continue;
      const x = pad + c * cell + gap;
      const y = pad + r * cell + gap;
      fillRoundRect(ctx, x, y, w, w, cornerR);
    }
  }
}

function drawFinderPatterns(ctx: CanvasRenderingContext2D, pad: number, cell: number, n: number): void {
  drawFinderPattern(ctx, pad + 0 * cell, pad + 0 * cell, cell, MODULE_COLOR);
  drawFinderPattern(ctx, pad + (n - 7) * cell, pad + 0 * cell, cell, MODULE_COLOR);
  drawFinderPattern(ctx, pad + 0 * cell, pad + (n - 7) * cell, cell, MODULE_COLOR);
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

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.clip();

  if (logoUrl?.trim()) {
    const img = await loadImageCors(logoUrl.trim());
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
  ctx.fillText("Q", centerX, centerY * 1.02);
  ctx.restore();
}

export type GenerateQrCanvasOptions = {
  /** Gesamtbreite/-höhe in Pixel inkl. 16px Rand */
  size?: number;
};

/**
 * Erzeugt einen Qrave-stilisierten QR-Code (Canvas): abgerundete Finder & Module, Logo in der Mitte.
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
  canvas.width = outer;
  canvas.height = outer;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D nicht verfügbar");
  }

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, outer, outer);

  drawDataModules(ctx, modules, PAD, cell, n);
  drawFinderPatterns(ctx, PAD, cell, n);

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
  return canvas.toDataURL("image/png");
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
