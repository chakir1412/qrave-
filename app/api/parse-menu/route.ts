import { NextResponse } from "next/server";
import {
  PARSE_MENU_PROMPT,
  parseMenuJsonFromModel,
  type ParsedMenuItemDto,
} from "@/lib/parse-menu";

export const maxDuration = 120;

const MODEL = "claude-sonnet-4-20250514";
const CHUNK_SIZE = 2000;
const MAX_CHUNKS = 8;
const CHUNK_MAX_TOKENS = 4000;
const CHUNK_RETRY_SPLIT_MIN_LENGTH = 1000;

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
                text: `${PARSE_MENU_PROMPT}

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

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY fehlt (Server-Umgebung)." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Formular-Daten konnten nicht gelesen werden." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  }
  const extractedText = formData.get("extractedText") as string | null;

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Leere Datei." }, { status: 400 });
  }
  if (buf.length > 32 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Datei zu groß (max. 32 MB)." },
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

  let userContent: AnthropicContentPart[];
  let usePdfBeta = false;

  if (isPdf) {
    const normalizedExtractedText = extractedText?.trim() ?? "";
    if (!normalizedExtractedText) {
      return NextResponse.json(
        { error: "Kein Text aus PDF extrahiert. Bitte erneut versuchen." },
        { status: 422 },
      );
    }
    const chunks = splitTextIntoChunks(normalizedExtractedText, CHUNK_SIZE);
    const allItemArrays = await Promise.all(chunks.map((chunk) => parseChunk(chunk, apiKey)));
    const merged = dedupeItems(allItemArrays.flat());
    return NextResponse.json({ items: merged });
  } else if (isPng) {
    userContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: base64,
        },
      },
      { type: "text", text: PARSE_MENU_PROMPT },
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
      { type: "text", text: PARSE_MENU_PROMPT },
    ];
  } else {
    return NextResponse.json(
      { error: "Nur PDF oder JPG/PNG erlaubt." },
      { status: 400 },
    );
  }

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
      max_tokens: 4000,
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
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let anthropicBody: AnthropicMessageResponse;
  try {
    anthropicBody = JSON.parse(rawText) as AnthropicMessageResponse;
  } catch {
    return NextResponse.json(
      { error: "Ungültige Antwort der KI." },
      { status: 502 },
    );
  }

  const textBlock = anthropicBody.content?.find((c) => c.type === "text");
  const text = textBlock?.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json(
      { error: "Kein Text in der KI-Antwort." },
      { status: 502 },
    );
  }

  const cleanedResponse = normalizeModelJsonText(text);
  try {
    const parsed = JSON.parse(cleanedResponse) as unknown;
    if (Array.isArray(parsed)) {
      const items = parseMenuJsonFromModel(JSON.stringify({ items: parsed }));
      return NextResponse.json({ items });
    }
    const asObj = parsed as { items?: unknown };
    if (Array.isArray(asObj?.items)) {
      const items = parseMenuJsonFromModel(JSON.stringify({ items: asObj.items }));
      return NextResponse.json({ items });
    }
    const items = parseMenuJsonFromModel(cleanedResponse);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("JSON parse error:", e);
    console.error("Raw response:", cleanedResponse.slice(0, 500));
    return NextResponse.json(
      { error: "KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen." },
      { status: 422 },
    );
  }
}
