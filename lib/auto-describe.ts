import type { ParsedMenuItemDto } from "@/lib/parse-menu";

/** Modell + Limits müssen identisch zu /api/dashboard/generate-description bleiben,
 *  damit manuelles und Bulk-Auto-Befüllen denselben Stil liefern. */
const MODEL = "claude-haiku-4-5-20251001";
const MAX_LENGTH = 200;
const BATCH_SIZE = 10;

const SYSTEM_PROMPT =
  "Du schreibst kurze, appetitliche Beschreibungen für Restaurant-Gerichte auf Deutsch. " +
  "Maximal 200 Zeichen, in ein bis zwei Sätzen, ohne Anführungszeichen, ohne Aufzählungen, ohne den Namen des Gerichts zu wiederholen. " +
  "Sinnliche Sprache, konkrete Zutaten oder Zubereitungs-Hinweise, keine Floskeln wie 'leckere Mahlzeit'.";

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
};

function buildPrompt(item: Pick<ParsedMenuItemDto, "name" | "kategorie">): string {
  const name = item.name.trim();
  const kategorie = item.kategorie.trim();
  return kategorie.length > 0
    ? `Gericht: ${name}\nKategorie: ${kategorie}\n\nGenerate eine Beschreibung.`
    : `Gericht: ${name}\n\nGenerate eine Beschreibung.`;
}

async function generateOne(
  item: Pick<ParsedMenuItemDto, "name" | "kategorie">,
  apiKey: string,
): Promise<string | null> {
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
        max_tokens: 220,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildPrompt(item) }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AnthropicResponse;
    const raw = json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (raw.length === 0) return null;
    const cleaned = raw.replace(/^["„]/, "").replace(/["“]$/, "").trim();
    return cleaned.length <= MAX_LENGTH
      ? cleaned
      : `${cleaned.slice(0, MAX_LENGTH - 1).trimEnd()}…`;
  } catch {
    return null;
  }
}

/** Reichert Items ohne `beschreibung` in-place mit einer Claude-Haiku-Beschreibung an.
 *  Max {@link BATCH_SIZE} Calls parallel. Fehler einzelner Items werden still
 *  geschluckt — das Item bleibt dann ohne Beschreibung (Wirt kann manuell
 *  ergänzen). */
export async function enrichItemsWithDescriptions(
  items: ParsedMenuItemDto[],
  apiKey: string,
): Promise<void> {
  const targets = items.filter((it) => (it.beschreibung ?? "").trim().length === 0 && it.name.trim().length > 0);
  if (targets.length === 0) return;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((it) => generateOne(it, apiKey)));
    batch.forEach((it, idx) => {
      const desc = results[idx];
      if (desc && desc.length > 0) {
        it.beschreibung = desc;
      }
    });
  }
}
