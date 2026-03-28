export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function greetingLabel(): "Morgen" | "Mittag" | "Nachmittag" | "Abend" {
  const h = new Date().getHours();
  if (h < 11) return "Morgen";
  if (h < 14) return "Mittag";
  if (h < 18) return "Nachmittag";
  return "Abend";
}

export function formatDateLongDe(d = new Date()): string {
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatPreisEUR(preis: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(preis);
}

export async function extractDominantColor(file: File): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("img"));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const maxSize = 200;
  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
  canvas.width = Math.max(1, Math.floor(img.width * ratio));
  canvas.height = Math.max(1, Math.floor(img.height * ratio));

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const colorCount = new Map<string, number>();

  for (let i = 0; i < data.length; i += 4 * 5) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;

    if (a < 200) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 30 || min > 225) continue;

    const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(
      b / 16,
    ) * 16}`;
    colorCount.set(key, (colorCount.get(key) ?? 0) + 1);
  }

  if (colorCount.size === 0) return null;

  const [best] = [...colorCount.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["0,0,0"];
  const [r, g, b] = best.split(",").map((v) => Number.parseInt(v, 10));

  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
