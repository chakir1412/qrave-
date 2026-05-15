import { NextResponse } from "next/server";
import { PARSE_MENU_PROMPT, parseMenuJsonFromModel, type ParsedMenuItemDto } from "@/lib/parse-menu";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { enrichItemsWithDescriptions } from "@/lib/auto-describe";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-20250514";
const MAX_PDF_BYTES = 4_000_000;

/** Schlanke Onboarding-Variante des /api/parse-menu-Endpoints.
 *  - Kein Founder-Auth — stattdessen IP-Rate-Limit (5/h)
 *  - PDF-Binary base64 direkt an Anthropic (native PDF-Unterstützung via
 *    `anthropic-beta: pdfs-2024-09-25`). Kein lokales pdfjs/canvas auf
 *    Vercel — pdfjs v5 lädt sonst Polyfills wie `@napi-rs/canvas`, die in
 *    der Lambda nicht vorhanden sind (`ReferenceError: DOMMatrix`).
 *  - Funktioniert für Text-PDFs und gescannte PDFs gleichermaßen. */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("onboarding-extract-menu", ip, 5, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte später erneut versuchen." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Anfrage-Body konnte nicht gelesen werden." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  }
  const lowerName = file.name.toLowerCase();
  const isPdf = (file.type || "").toLowerCase() === "application/pdf" || lowerName.endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Nur PDF-Dateien werden akzeptiert." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Leere PDF-Datei." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF zu groß (max. ${Math.round(MAX_PDF_BYTES / 1_000_000)} MB).` },
      { status: 413 },
    );
  }

  const pdfBuf = Buffer.from(await file.arrayBuffer());
  const pdfB64 = pdfBuf.toString("base64");

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfB64,
                },
              },
              { type: "text", text: PARSE_MENU_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!anthropicRes.ok) {
      const raw = await anthropicRes.text();
      console.error("[onboarding/extract-menu] Anthropic:", anthropicRes.status, raw.slice(0, 500));
      return NextResponse.json(
        { error: "Speisekarten-Analyse fehlgeschlagen. Du kannst Items später ergänzen." },
        { status: 500 },
      );
    }
    const data = (await anthropicRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    let items: ParsedMenuItemDto[] = [];
    try {
      items = parseMenuJsonFromModel(text);
    } catch (parseErr) {
      console.error("[onboarding/extract-menu] parse:", parseErr);
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden." },
        { status: 500 },
      );
    }
    // Für alle Items ohne Beschreibung automatisch eine via Claude Haiku
    // generieren (Batch 10 parallel). Fehler werden still geschluckt — der
    // Wirt kann im Wizard manuell nachtragen.
    await enrichItemsWithDescriptions(items, apiKey);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[onboarding/extract-menu] fetch:", err);
    return NextResponse.json({ error: "Netzwerkfehler bei Speisekarten-Analyse." }, { status: 502 });
  }
}
