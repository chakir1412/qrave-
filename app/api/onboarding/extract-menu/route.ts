import { NextResponse } from "next/server";
import { PARSE_MENU_PROMPT, parseMenuJsonFromModel, type ParsedMenuItemDto } from "@/lib/parse-menu";
import { extractPdfTextFromBuffer, MIN_TEXT_CHARS_TEXT_PATH } from "@/lib/server/pdf-scan";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-20250514";
const MAX_PDF_BYTES = 4_000_000;
const MAX_TEXT_CHARS = 200_000;

/** Schlanke Onboarding-Variante des /api/parse-menu-Endpoints.
 *  - Kein Founder-Auth — stattdessen IP-Rate-Limit (5/h)
 *  - Nur Text-Path (kein Page-Chunking, kein Vision)
 *  - Für komplexere PDFs muss der Wirt nach Freischaltung im
 *    Dashboard nochmal hochladen (Founder-Endpoint). */
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

  let pdfText: string;
  try {
    pdfText = await extractPdfTextFromBuffer(pdfBuf);
  } catch (err) {
    console.error("[onboarding/extract-menu] PDF-Text:", err);
    return NextResponse.json(
      { error: "PDF konnte nicht gelesen werden. Du kannst Items später im Dashboard ergänzen." },
      { status: 400 },
    );
  }

  if (pdfText.length < MIN_TEXT_CHARS_TEXT_PATH) {
    return NextResponse.json(
      {
        error:
          "PDF enthält kaum Text (vermutlich nur Bilder). Bitte später im Dashboard nachtragen oder eine Text-PDF hochladen.",
      },
      { status: 400 },
    );
  }

  const chunk = pdfText.length > MAX_TEXT_CHARS ? pdfText.slice(0, MAX_TEXT_CHARS) : pdfText;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${PARSE_MENU_PROMPT}\n\nText-Inhalt der Speisekarte:\n${chunk}`,
              },
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
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[onboarding/extract-menu] fetch:", err);
    return NextResponse.json({ error: "Netzwerkfehler bei Speisekarten-Analyse." }, { status: 502 });
  }
}
