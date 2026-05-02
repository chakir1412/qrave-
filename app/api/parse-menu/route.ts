import { NextResponse } from "next/server";
import { parseMenuJsonFromModel, type ParsedMenuItemDto } from "@/lib/parse-menu";
import {
  extractPdfTextFromBuffer,
  MIN_TEXT_CHARS_TEXT_PATH,
  pdfBufferToPngBase64Pages,
} from "@/lib/server/pdf-scan";

/** Vercel Serverless Timeout (PDF-Rendering + KI). */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Grober Schutz vor riesigem Form-Body (Vercel ~4,5 MB Request-Limit). */
const MAX_EXTRACTED_TEXT_CHARS = 3_500_000;

/** PDF-Binary direkt an Anthropic (Base64 im JSON); unter Limit bleibt Request unter Vercel ~4,5 MB. */
const MAX_PDF_BYTES_DIRECT = 2_500_000;

const MODEL = "claude-sonnet-4-20250514";
const CHUNK_SIZE = 2000;
const MAX_CHUNKS = 8;
const CHUNK_MAX_TOKENS = 4000;
const CHUNK_RETRY_SPLIT_MIN_LENGTH = 1000;
const PDF_IMPORT_PROMPT = `Du bist ein Experte für Restaurantspeisekarten. Extrahiere alle Menüpunkte aus der Speisekarte.
Antworte NUR mit einem JSON Array, ohne Markdown, ohne Erklärung, ohne Codeblöcke:
[{"name":"...","beschreibung":"...","preis":12.90,"kategorie":"...","emoji":"...","main_tab":"FOOD oder DRINKS"}]
KATEGORIEN:

Burger, Sandwiches, Wraps -> "Burger"
Pizza -> "Pizza"
Pasta -> "Pasta"
Hauptgerichte, Fleisch, Fisch -> "Hauptgerichte"
Vorspeisen, Antipasti -> "Vorspeisen"
Salate -> "Salads"
Suppen -> "Suppen"
Beilagen, Sides -> "Sides"
Extras, Zusätze, Toppings -> "Extras"
Desserts -> "Desserts"
Frühstück -> "Frühstück"
Bowls -> "Bowls"
Sushi, Nigiri, Maki -> "Sushi"
Softdrinks, Cola, Limo, Schorle, Wasser, Säfte, Eistee, Spezi, Energy -> "Drinks" + main_tab: "DRINKS"
Bier, Radler, Weizen, Craft Beer -> "Bier" + main_tab: "DRINKS"
Wein, Prosecco, Champagner, Sekt -> "Weine" + main_tab: "DRINKS"
Cocktails, Longdrinks, Shots, Spirituosen -> "Cocktails" + main_tab: "DRINKS"
Kaffee, Espresso, Cappuccino, Latte, Flat White -> "Kaffee" + main_tab: "DRINKS"
Tee, Matcha, Chai -> "Tee" + main_tab: "DRINKS"

NAMEN:

Kurz und klar - keine Variantenbeschreibungen im Namen
"Fritz-Kola Original | Super Zero" -> name: "Fritz-Kola", beschreibung: "Original | Super Zero, 0,33l"
Allergenkennzeichnungen (A1, C, G, J etc.) entfernen
Mengenangaben (0,33l) in die beschreibung

VARIANTEN:

"Fresh Salad mit Avocado 13.90, mit Ziegenkäse 13.90" -> zwei separate Items

PREISE:

Dezimalzahl: 10.90 nicht "10,90 EUR"
Kein Preis vorhanden -> 0

EMOJIS:

Burger->🍔 Pizza->🍕 Pasta->🍝 Salat->🥗 Suppe->🍲
Bier->🍺 Wein->🍷 Cocktail->🍸 Kaffee->☕ Wasser->💧
Softdrinks->🥤 Tee->🍵 Dessert->🍰 Fleisch->🥩 Vegetarisch->🌱

main_tab:

Alle Getränke -> "DRINKS"
Alles andere -> "FOOD"`;

type AnthropicContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png";
        data: string;
      };
    }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      };
    };

type AnthropicMessageResponse = {
  content: Array<{ type: string; text?: string }>;
};

type AnthropicErrorBody = {
  error?: { type?: string; message?: string };
};

function normalizeModelJsonText(input: string): string {
  let t = input.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

/** Versucht abgeschnittenes Modell-JSON zu schließen (z. B. mitten im letzten Item). */
function repairJson(text: string): string {
  let t = text.replace(/,\s*([}\]])/g, "$1");

  if (!t.includes('"items"')) {
    return t;
  }

  const itemsKeyIdx = t.indexOf('"items"');
  const itemsBracketIdx = t.indexOf("[", itemsKeyIdx);
  if (itemsBracketIdx === -1) {
    return t;
  }

  const arrayContent = t.slice(itemsBracketIdx + 1);

  const lastPairComma = arrayContent.lastIndexOf("},");
  const lastCompleteObjEnd = lastPairComma === -1 ? -1 : lastPairComma + 1;

  const lastOpen = arrayContent.lastIndexOf("{");
  const lastClose = arrayContent.lastIndexOf("}");
  let cleanArray = arrayContent;
  if (lastOpen > lastClose) {
    cleanArray = arrayContent.slice(0, lastOpen).trimEnd();
    if (cleanArray.endsWith(",")) {
      cleanArray = cleanArray.slice(0, -1).trimEnd();
    }
  }

  if (lastCompleteObjEnd === -1 && cleanArray.trim() === "") {
    const attempt = `${t.slice(0, itemsBracketIdx)}[]}`;
    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      return '{"items":[]}';
    }
  }

  let middle = cleanArray.trim();
  if (middle.endsWith(",")) {
    middle = middle.slice(0, -1).trimEnd();
  }

  let depth = 0;
  for (const ch of middle) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  let closeObjs = "";
  while (depth > 0) {
    closeObjs += "}";
    depth -= 1;
  }

  const prefix = t.slice(0, itemsBracketIdx + 1);
  const rebuilt = `${prefix}${middle}${closeObjs}]}`;
  const withRoot = rebuilt.trimEnd().endsWith("}") ? rebuilt : `${rebuilt}\n}`;

  try {
    JSON.parse(withRoot);
    return withRoot;
  } catch {
    return '{"items":[]}';
  }
}

function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < normalized.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(i + chunkSize, normalized.length);
    if (end < normalized.length) {
      const lastNewline = normalized.lastIndexOf("\n", end);
      if (lastNewline > i) end = lastNewline;
    }
    const chunk = normalized.slice(i, end).trim();
    if (chunk) chunks.push(chunk);
    i = end;
  }
  return chunks;
}

async function parseChunkOnce(chunk: string, apiKey: string): Promise<ParsedMenuItemDto[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: CHUNK_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${PDF_IMPORT_PROMPT}

Text-Chunk der Speisekarte:
${chunk}`,
              },
            ],
          },
        ],
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      return [];
    }
    let body: AnthropicMessageResponse;
    try {
      body = JSON.parse(raw) as AnthropicMessageResponse;
    } catch {
      return [];
    }
    const text = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (!text) {
      return [];
    }
    try {
      const items = parseMenuJsonFromModel(text);
      return items;
    } catch {
      const cleanedResponse = normalizeModelJsonText(text);
      const repaired = repairJson(cleanedResponse);

      const tryParseToItems = (rawJson: string): ParsedMenuItemDto[] | null => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawJson) as unknown;
        } catch {
          return null;
        }
        try {
          if (Array.isArray(parsed)) {
            return parseMenuJsonFromModel(JSON.stringify({ items: parsed }));
          }
          const asObj = parsed as { items?: unknown };
          if (Array.isArray(asObj?.items)) {
            return parseMenuJsonFromModel(JSON.stringify({ items: asObj.items }));
          }
        } catch {
          return null;
        }
        return null;
      };

      try {
        const fromRepairedModel = parseMenuJsonFromModel(repaired);
        return fromRepairedModel;
      } catch {
        const fromRepaired = tryParseToItems(repaired);
        if (fromRepaired) {
          return fromRepaired;
        }
        const fromClean = tryParseToItems(cleanedResponse);
        if (fromClean) {
          return fromClean;
        }
        return [];
      }
    }
  } catch {
    return [];
  }
}

async function parseChunk(chunk: string, apiKey: string): Promise<ParsedMenuItemDto[]> {
  const items = await parseChunkOnce(chunk, apiKey);

  if (items.length === 0 && chunk.length > CHUNK_RETRY_SPLIT_MIN_LENGTH) {
    const mid = Math.floor(chunk.length / 2);
    const lastNewline = chunk.lastIndexOf("\n", mid);
    const splitAt = lastNewline > 0 ? lastNewline : mid;

    const half1 = chunk.slice(0, splitAt).trim();
    const half2 = chunk.slice(splitAt).trim();

    const [items1, items2] = await Promise.all([
      half1.length > 0
        ? parseChunkOnce(half1, apiKey)
        : Promise.resolve([] as ParsedMenuItemDto[]),
      half2.length > 0
        ? parseChunkOnce(half2, apiKey)
        : Promise.resolve([] as ParsedMenuItemDto[]),
    ]);

    return [...items1, ...items2];
  }

  return items;
}

function dedupeItems(items: ParsedMenuItemDto[]): ParsedMenuItemDto[] {
  const seen = new Set<string>();
  const out: ParsedMenuItemDto[] = [];
  for (const item of items) {
    const key = `${item.name.trim().toLowerCase()}::${item.preis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Ein Anthropic messages-Call mit Bild oder PDF-Dokument → strukturierte Menü-Items. */
async function anthropicExtractMenuItems(
  userContent: AnthropicContentPart[],
  apiKey: string,
  options: { usePdfBeta: boolean; maxTokens: number },
): Promise<ParsedMenuItemDto[]> {
  const { usePdfBeta, maxTokens } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (usePdfBeta) {
    headers["anthropic-beta"] = "pdfs-2024-09-25";
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  const rawText = await anthropicRes.text();
  if (!anthropicRes.ok) {
    let msg = `Anthropic API (${anthropicRes.status})`;
    try {
      const errJson = JSON.parse(rawText) as AnthropicErrorBody;
      if (errJson.error?.message) msg = errJson.error.message;
    } catch {
      if (rawText) msg = rawText.slice(0, 200);
    }
    throw new Error(msg);
  }

  let anthropicBody: AnthropicMessageResponse;
  try {
    anthropicBody = JSON.parse(rawText) as AnthropicMessageResponse;
  } catch {
    throw new Error("Ungültige Antwort der KI.");
  }

  const textBlock = anthropicBody.content?.find((c) => c.type === "text");
  const text = textBlock?.text?.trim() ?? "";
  if (!text) {
    throw new Error("Kein Text in der KI-Antwort.");
  }

  const cleanedResponse = normalizeModelJsonText(text);
  try {
    const parsed = JSON.parse(cleanedResponse) as unknown;
    if (Array.isArray(parsed)) {
      return parseMenuJsonFromModel(JSON.stringify({ items: parsed }));
    }
    const asObj = parsed as { items?: unknown };
    if (Array.isArray(asObj?.items)) {
      return parseMenuJsonFromModel(JSON.stringify({ items: asObj.items }));
    }
    return parseMenuJsonFromModel(cleanedResponse);
  } catch (e) {
    console.error("JSON parse error:", e);
    console.error("Raw response:", cleanedResponse.slice(0, 500));
    throw new Error("KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.");
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY nicht gesetzt" },
        { status: 500 },
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error("parse-menu: formData failed", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "Anfrage-Body konnte nicht gelesen werden (evtl. zu groß für das Server-Limit).",
        },
        { status: 400 },
      );
    }

    console.log("parse-menu FormData keys:", [...formData.keys()]);

    const pdfDocumentRaw = formData.get("pdfDocument");
    const pdfDocument =
      pdfDocumentRaw === "1" ||
      pdfDocumentRaw === "true" ||
      String(pdfDocumentRaw ?? "").toLowerCase() === "true";

    const pdfTextOnlyRaw = formData.get("pdfTextOnly");
    const pdfTextOnly =
      pdfTextOnlyRaw === "1" ||
      pdfTextOnlyRaw === "true" ||
      String(pdfTextOnlyRaw ?? "").toLowerCase() === "true";

    const extractedTextField = formData.get("extractedText");
    const extractedTextStr =
      typeof extractedTextField === "string"
        ? extractedTextField
        : extractedTextField != null
          ? String(extractedTextField)
          : null;

    /** PDF: Binary direkt an Anthropic (kleine Dateien; zuverlässiger als nur Browser-Text). */
    if (pdfDocument) {
      const pdfFile = formData.get("file");
      if (!(pdfFile instanceof File)) {
        return NextResponse.json(
          { success: false, error: "Keine PDF-Datei übermittelt." },
          { status: 400 },
        );
      }
      const dm = (pdfFile.type || "").toLowerCase();
      const nl = pdfFile.name.toLowerCase();
      const isPdfMime = dm === "application/pdf" || nl.endsWith(".pdf");
      if (!isPdfMime) {
        return NextResponse.json(
          { success: false, error: "Nur PDF-Dateien für pdfDocument erlaubt." },
          { status: 400 },
        );
      }
      const pdfBuf = Buffer.from(await pdfFile.arrayBuffer());
      if (pdfBuf.length === 0) {
        return NextResponse.json({ success: false, error: "Leere PDF-Datei." }, { status: 400 });
      }
      if (pdfBuf.length > MAX_PDF_BYTES_DIRECT) {
        return NextResponse.json(
          {
            success: false,
            error: `PDF zu groß für Direkt-Analyse (max. ${Math.round(MAX_PDF_BYTES_DIRECT / 1_000_000)} MB). Bitte PDF komprimieren – es wird automatisch der Text-Fallback verwendet.`,
          },
          { status: 413 },
        );
      }
      try {
        let extracted = "";
        try {
          extracted = await extractPdfTextFromBuffer(pdfBuf);
        } catch (texErr) {
          console.error("parse-menu extractPdfTextFromBuffer:", texErr);
        }
        const textNorm = extracted.replace(/\s+/g, " ").trim();
        const isTextBased = textNorm.length >= MIN_TEXT_CHARS_TEXT_PATH;

        let merged: ParsedMenuItemDto[] = [];
        if (isTextBased) {
          const chunks = splitTextIntoChunks(extracted, CHUNK_SIZE);
          const allItemArrays = await Promise.all(chunks.map((chunk) => parseChunk(chunk, apiKey)));
          merged = dedupeItems(allItemArrays.flat());
        }

        if (merged.length > 0) {
          return NextResponse.json({ success: true, items: merged });
        }

        /** Gescannt / leere Text-Parse: Seiten als PNG an Anthropic. */
        let pngs: string[] = [];
        try {
          pngs = await pdfBufferToPngBase64Pages(pdfBuf, 4);
        } catch (renderErr) {
          console.error("parse-menu pdfBufferToPngBase64Pages:", renderErr);
        }

        if (pngs.length > 0) {
          const imageContent: AnthropicContentPart[] = [
            ...pngs.map(
              (data): AnthropicContentPart => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data,
                },
              }),
            ),
            { type: "text", text: PDF_IMPORT_PROMPT },
          ];
          const imgItems = await anthropicExtractMenuItems(imageContent, apiKey, {
            usePdfBeta: false,
            maxTokens: 8192,
          });
          if (imgItems.length > 0) {
            return NextResponse.json({ success: true, items: imgItems });
          }
        }

        /** Letzter Fallback: natives PDF an Anthropic (Beta). */
        const pdfB64 = pdfBuf.toString("base64");
        const docContent: AnthropicContentPart[] = [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfB64,
            },
          },
          { type: "text", text: PDF_IMPORT_PROMPT },
        ];
        const docItems = await anthropicExtractMenuItems(docContent, apiKey, {
          usePdfBeta: true,
          maxTokens: 8192,
        });
        if (docItems.length === 0) {
          return NextResponse.json(
            { success: false, error: "Keine Gerichte erkannt." },
            { status: 422 },
          );
        }
        return NextResponse.json({ success: true, items: docItems });
      } catch (err) {
        console.error("parse-menu pdfDocument:", err);
        return NextResponse.json(
          {
            success: false,
            error: err instanceof Error ? err.message : "Analyse fehlgeschlagen",
          },
          { status: 502 },
        );
      }
    }

    /** PDF: nur extrahierter Text — ohne PDF-Binary (große PDFs / Vercel-Limit). */
    if (pdfTextOnly) {
      const normalizedExtractedText = extractedTextStr?.trim() ?? "";
      if (!normalizedExtractedText) {
        return NextResponse.json(
          { success: false, error: "Kein Text aus PDF übermittelt." },
          { status: 422 },
        );
      }
      if (normalizedExtractedText.length > MAX_EXTRACTED_TEXT_CHARS) {
        return NextResponse.json(
          {
            success: false,
            error: `Extrahierter Text zu lang (max. ca. ${Math.floor(MAX_EXTRACTED_TEXT_CHARS / 1_000_000)} Mio. Zeichen).`,
          },
          { status: 413 },
        );
      }
      const chunks = splitTextIntoChunks(normalizedExtractedText, CHUNK_SIZE);
      const allItemArrays = await Promise.all(chunks.map((chunk) => parseChunk(chunk, apiKey)));
      const merged = dedupeItems(allItemArrays.flat());
      if (merged.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Keine Gerichte erkannt. Gescannte PDFs oft ohne Text: kleineres PDF hochladen (direkte PDF-Analyse bis ca. 2,5 MB) oder Speisekarte als JPG/PNG exportieren.",
          },
          { status: 422 },
        );
      }
      return NextResponse.json({ success: true, items: merged });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Keine Datei übermittelt." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ success: false, error: "Leere Datei." }, { status: 400 });
    }
    if (buf.length > 32 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Datei zu groß (max. 32 MB)." },
        { status: 400 },
      );
    }

    const base64 = buf.toString("base64");
    const declaredMime = (file.type || "").toLowerCase();
    const nameLower = file.name.toLowerCase();

    const isPdf =
      declaredMime === "application/pdf" || nameLower.endsWith(".pdf");
    const isPng = declaredMime === "image/png" || nameLower.endsWith(".png");
    const isJpeg =
      declaredMime === "image/jpeg" ||
      declaredMime === "image/jpg" ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg");

    if (isPdf) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF-Anfrage ungültig: verwenden Sie pdfDocument (Datei ≤ ca. 2,5 MB) oder pdfTextOnly mit extrahiertem Text.",
        },
        { status: 400 },
      );
    }

    let userContent: AnthropicContentPart[];

    if (isPng) {
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64,
          },
        },
        { type: "text", text: PDF_IMPORT_PROMPT },
      ];
    } else if (isJpeg) {
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: base64,
          },
        },
        { type: "text", text: PDF_IMPORT_PROMPT },
      ];
    } else {
      return NextResponse.json(
        { success: false, error: "Nur PDF oder JPG/PNG erlaubt." },
        { status: 400 },
      );
    }

    try {
      const imgItems = await anthropicExtractMenuItems(userContent, apiKey, {
        usePdfBeta: false,
        maxTokens: 4096,
      });
      if (imgItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Keine Gerichte erkannt." },
          { status: 422 },
        );
      }
      return NextResponse.json({ success: true, items: imgItems });
    } catch (err) {
      console.error("parse-menu image:", err);
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Analyse fehlgeschlagen",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("PDF Import Error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
