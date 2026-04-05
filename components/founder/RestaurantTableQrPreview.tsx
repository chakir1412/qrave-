"use client";

import { useEffect, useState } from "react";
import { downloadQrPng, generateQrPngDataUrl } from "@/lib/generate-qr-canvas";

type Props = {
  menuUrl: string;
  logoUrl: string | null;
  downloadFilenameBase: string;
  previewSize?: number;
  exportSize?: number;
  orange: string;
};

export function RestaurantTableQrPreview({
  menuUrl,
  logoUrl,
  downloadFilenameBase,
  previewSize = 168,
  exportSize = 512,
  orange,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void generateQrPngDataUrl(menuUrl, logoUrl, previewSize).then((u) => {
      if (!cancelled) setSrc(u);
    });
    return () => {
      cancelled = true;
    };
  }, [menuUrl, logoUrl, previewSize]);

  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <div
        className="flex items-center justify-center overflow-hidden rounded-xl bg-white"
        style={{ width: previewSize, height: previewSize }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL aus Canvas
          <img src={src} width={previewSize} height={previewSize} alt="" />
        ) : (
          <span className="text-xs font-semibold text-neutral-400">QR…</span>
        )}
      </div>
      <button
        type="button"
        disabled={downloadBusy || !src}
        onClick={() => {
          setDownloadBusy(true);
          void generateQrPngDataUrl(menuUrl, logoUrl, exportSize)
            .then((u) => {
              downloadQrPng(downloadFilenameBase, u);
            })
            .finally(() => setDownloadBusy(false));
        }}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: `1px solid ${orange}`,
          fontWeight: 700,
          fontSize: 12,
          color: orange,
          cursor: downloadBusy || !src ? "not-allowed" : "pointer",
          background: "transparent",
          opacity: downloadBusy || !src ? 0.55 : 1,
        }}
      >
        {downloadBusy ? "…" : "QR herunterladen"}
      </button>
    </div>
  );
}
