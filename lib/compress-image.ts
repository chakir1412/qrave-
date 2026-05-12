/** Komprimiert ein Bild im Browser via Canvas. Skaliert auf max `maxWidth` px
 *  (proportional), encoded als JPEG mit `quality` (0..1). Wenn das Original
 *  bereits unter maxWidth liegt, bleibt die Auflösung erhalten — re-encoded
 *  wird trotzdem, damit das Output-Format konsistent JPEG ist (kleiner als
 *  PNG-Quellen).
 *
 *  Pure-Client-API (HTMLImageElement, HTMLCanvasElement). Nur in
 *  Browser-Kontexten aufrufen. */
export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; quality?: number } = {},
): Promise<File> {
  const maxWidth = options.maxWidth ?? 1920;
  const quality = options.quality ?? 0.8;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const targetWidth = Math.min(img.naturalWidth, maxWidth);
    const scale = targetWidth / img.naturalWidth;
    const targetHeight = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
