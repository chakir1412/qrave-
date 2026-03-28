import {
  PARSE_MENU_PROMPT,
  parseMenuJsonFromModel,
  type ParsedMenuItemDto,
} from "@/lib/parse-menu";

const MODEL = "claude-sonnet-4-20250514";

type AnthropicMessageResponse = {
  content: Array<{ type: string; text?: string }>;
};

type AnthropicErrorBody = {
  error?: { type?: string; message?: string };
};

const MAX_TEXT_CHARS = 120_000;

/**
 * Sendet extrahierten Speisekarten-Text an Claude (gleicher Prompt wie PDF/Foto).
 */
export async function parseMenuPlainTextWithClaude(
  plainText: string,
  apiKey: string,
): Promise<{ items: ParsedMenuItemDto[] } | { error: string }> {
  const trimmed = plainText.trim();
  if (trimmed.length < 40) {
    return { error: "Zu wenig Text auf der Seite (Speisekarte?)." };
  }
  const bodyText =
    trimmed.length > MAX_TEXT_CHARS ? `${trimmed.slice(0, MAX_TEXT_CHARS)}\n\n[… gekürzt]` : trimmed;

  const userMessage = `${PARSE_MENU_PROMPT}

---
Der folgende Text stammt von einer Webseite (HTML wurde entfernt). Extrahiere daraus die Speisekarte:

${bodyText}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userMessage }],
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
    return { error: msg };
  }

  let anthropicBody: AnthropicMessageResponse;
  try {
    anthropicBody = JSON.parse(rawText) as AnthropicMessageResponse;
  } catch {
    return { error: "Ungültige Antwort der KI." };
  }

  const textBlock = anthropicBody.content?.find((c) => c.type === "text");
  const text = textBlock?.text?.trim() ?? "";
  if (!text) {
    return { error: "Kein Text in der KI-Antwort." };
  }

  try {
    const items = parseMenuJsonFromModel(text);
    return { items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "JSON konnte nicht verarbeitet werden.";
    return { error: msg };
  }
}
