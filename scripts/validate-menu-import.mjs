#!/usr/bin/env node
/**
 * Validierungs-Skript für den PDF-Import-Flow (/api/parse-menu).
 *
 * Extrahiert aus einer echten Speisekarte-PDF pro Item die Fußnoten-Codes
 * neben dem Gerichts-Namen, berechnet anhand einer *hart hinterlegten*
 * karteneigenen Legende (aktuell: LaFamigliaSpeisekarte-Schema) die
 * erwarteten `allergens[]` + `additives_text`, fährt parallel den echten
 * server-Extraktions-Flow durch (extractMenuLegend + per-page Sonnet-Call)
 * und vergleicht Item-für-Item. Ergebnis: Fehlerquote + vollständige
 * Abweichungsliste.
 *
 *   node scripts/validate-menu-import.mjs <pdf-pfad>
 *
 * Environment: braucht ANTHROPIC_API_KEY (aus .env.vercel-fresh oder Umgebung).
 *
 * Nicht für Prod-Aufrufe gedacht — reines Devtool. Ruft Anthropic direkt,
 * umgeht Auth + Rate-Limit + Streaming.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";

// ─── env laden ──────────────────────────────────────────────────────────
try {
  const envRaw = await readFile(".env.vercel-fresh", "utf8");
  for (const line of envRaw.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}

const PDF_PATH = process.argv[2];
if (!PDF_PATH) {
  console.error("Nutzung: node scripts/validate-menu-import.mjs <pdf>");
  process.exit(1);
}
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY fehlt (via .env.vercel-fresh oder Umgebung).");
  process.exit(1);
}

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";
const PAGE_MAX_TOKENS = 16000;
const MIN_PAGE_TEXT_CHARS = 100;

const LMIV_KEYS = [
  "gluten","krebstiere","eier","fisch","erdnuesse","soja","milch",
  "schalenfruechte","sellerie","senf","sesam","sulfite","lupinen","weichtiere",
];

// ─── Hart hinterlegte Ground-Truth-Legende für LaFamigliaSpeisekarte.pdf.
// Passend zu Seite 15 der PDF. Für andere Karten müsste dieses Objekt neu
// befüllt werden — Ziel des Skripts ist, den PROD-Flow gegen eine
// menschlich verifizierte Wahrheit abzugleichen.
const GROUND_TRUTH_LEGEND = {
  "1":  { label: "Farbstoff",                lmiv: null },
  "2":  { label: "Konservierungsstoffe",     lmiv: null },
  "3":  { label: "Chininhaltig",             lmiv: null },
  "4":  { label: "Koffeinhaltig",            lmiv: null },
  "5":  { label: "Nitrit",                   lmiv: null },
  "6":  { label: "Antioxidationsmittel",     lmiv: null },
  "7":  { label: "Geschwefelt",              lmiv: null },
  "8":  { label: "Geschwärzt",               lmiv: null },
  "9":  { label: "Säuremittel",              lmiv: null },
  "10": { label: "Stabilisator",             lmiv: null },
  "11": { label: "Aromaverstärker",          lmiv: null },
  "12": { label: "Geliermittel",             lmiv: null },
  "13": { label: "Süßungsmittel",            lmiv: null },
  "14": { label: "Gluten",                   lmiv: "gluten" },
  "15": { label: "Fisch",                    lmiv: "fisch" },
  "16": { label: "Krebstiere",               lmiv: "krebstiere" },
  "17": { label: "Schwefeldioxid & Sulfide", lmiv: "sulfite" },
  "18": { label: "Sellerie",                 lmiv: "sellerie" },
  "19": { label: "Milch & Laktose",          lmiv: "milch" },
  "20": { label: "Sesamsamen",               lmiv: "sesam" },
  "21": { label: "Nüsse, Mandeln, Pinienkerne", lmiv: "schalenfruechte" },
  "22": { label: "Eier",                     lmiv: "eier" },
  "23": { label: "Lupine",                   lmiv: "lupinen" },
  "24": { label: "Senf",                     lmiv: "senf" },
  "25": { label: "Soja",                     lmiv: "soja" },
  "26": { label: "Weichtiere",               lmiv: "weichtiere" },
  "27": { label: "Erdnüsse",                 lmiv: "erdnuesse" },
  "28": { label: "Alkoholhaltig",            lmiv: null },
  "29": { label: "Gewachst",                 lmiv: null },
};

// ─── Anthropic mit Disk-Cache ──────────────────────────────────────────
// Cache-Dir: /tmp/qrave-anthropic-cache. Key = SHA1 vom Request-Body.
// Damit lassen sich Analyse-Iterationen ohne neue API-Calls fahren.
const CACHE_DIR = "/tmp/qrave-anthropic-cache";
async function anthropic(body) {
  const key = createHash("sha1").update(JSON.stringify(body)).digest("hex");
  const cachePath = `${CACHE_DIR}/${key}.json`;
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf8"));
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 400)}`);
  const parsed = JSON.parse(raw);
  try {
    if (!existsSync(CACHE_DIR)) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    await writeFile(cachePath, JSON.stringify(parsed));
  } catch {
    /* cache-write ist optional */
  }
  return parsed;
}

// ─── Legenden-Pre-Extraction (1:1 wie in route.ts) ──────────────────────
async function extractLegend(fullText) {
  const text = fullText.trim();
  if (text.length < 200) return { found: false, entries: {} };
  const prompt = `Du analysierst den vollständigen Text einer Restaurant-Speisekarte und suchst NUR nach der Deklarations-Legende (die nummerierte oder alphabetische Liste, die Codes wie 1., 2., ... oder A, B, ... auf Klartext-Bezeichnungen wie "Farbstoff", "Milch & Laktose", "Gluten" abbildet).

Typische Überschriften: "Zusatzstoffe und Allergene", "Deklarationspflichtige Zusatzstoffe", "Allergen-Kennzeichnung", "Legende", oft am Ende der Karte.

Für jeden Legende-Eintrag klassifiziere, ob er einem der 14 LMIV-Allergene entspricht:
- gluten (auch: Weizen, Roggen, Gerste, Hafer, Dinkel, Kamut, glutenhaltiges Getreide)
- krebstiere (Crustaceans)
- eier (Ei, Eiweiß)
- fisch
- erdnuesse (Peanuts — NICHT Schalenfrüchte)
- soja
- milch (auch: Laktose, Milcheiweiß, Käse — aber "Milcheiweiß" allein als Zusatzstoff-Angabe ohne "Milch"-Kontext bleibt Zusatzstoff)
- schalenfruechte (Nüsse, Mandeln, Haselnüsse, Walnüsse, Cashews, Pistazien, Pekan, Paranüsse, Macadamia, Pinienkerne)
- sellerie
- senf
- sesam (Sesamsamen)
- sulfite (auch: Schwefeldioxid, Sulfide, geschwefelt)
- lupinen
- weichtiere (Muscheln, Tintenfisch, Austern, Schnecken)

Alles andere → lmiv_allergen_key: null.

Antworte NUR mit JSON:
{"found": true, "entries": {"1": {"label": "Farbstoff", "lmiv_allergen_key": null}, ...}}

Falls keine Legende: {"found": false, "entries": {}}

Speisekarte-Text:
${text.slice(0, 40000)}`;
  const body = await anthropic({
    model: HAIKU,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  let out = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (out.startsWith("```")) out = out.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(out);
    if (parsed.found !== true) return { found: false, entries: {} };
    return parsed;
  } catch {
    return { found: false, entries: {} };
  }
}

function formatLegendForPrompt(legend) {
  if (!legend.found || Object.keys(legend.entries).length === 0) {
    return `DIESE KARTE HAT KEINE AUFLÖSBARE DEKLARATIONS-LEGENDE. Für JEDES Item mit Codes: needs_review=true, allergens leer, additives_text leer. NICHT raten.`;
  }
  const codes = Object.keys(legend.entries).sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const lines = codes.map((c) => {
    const e = legend.entries[c];
    const tag = e.lmiv_allergen_key ? `LMIV-Allergen "${e.lmiv_allergen_key}"` : "Zusatzstoff / Hinweis";
    return `- Code "${c}" = "${e.label}" (${tag})`;
  });
  return `DIESE KARTE HAT DIE FOLGENDE LEGENDE (vom Wirt vorgegeben — GEHT VOR JEDER STANDARD-KONVENTION wie A-R/1-14):

${lines.join("\n")}

REGEL:
- Für JEDES Item: sammle die Codes, die direkt am Item stehen (klein, hochgestellt oder in Komma-Liste hinter dem Namen).
- Für jeden Code am Item: schlage in der Legende nach.
  - Wenn Eintrag ein LMIV-Allergen ist → Schlüssel in "allergens" hinzufügen.
  - Wenn Eintrag ein Zusatzstoff / Hinweis ist → Klartext-Label in "additives_text" komma-getrennt mit "enthält " Präfix.
- Wenn ein Code NICHT in der Legende auftaucht: weglassen und "needs_review": true.
- Wenn ein Item KEINE Codes hat: allergens: [], additives_text: "", needs_review: false.
- NIEMALS aus Zutaten oder Item-Namen ableiten. NIEMALS Codes erfinden.`;
}

const PROMPT_BASE = `Du bist ein Experte für Restaurantspeisekarten. Extrahiere alle Menüpunkte aus der Speisekarte.
Antworte NUR mit einem JSON Array:
[{"name":"...","beschreibung":"...","allergens":["gluten","milch"],"additives_text":"enthält Stabilisator","needs_review":false,"tags":[],"preis":12.90,"kategorie":"...","emoji":"...","main_tab":"FOOD oder DRINKS"}]

Für JEDES Item: Name kurz, Preis dezimal, main_tab "FOOD" oder "DRINKS".
ALLERGENS: nur diese 14 LMIV-Schlüssel — gluten, krebstiere, eier, fisch, erdnuesse, soja, milch, schalenfruechte, sellerie, senf, sesam, sulfite, lupinen, weichtiere.
Zuordnung Code → Allergen/Zusatzstoff folgt EXKLUSIV der Legende unten.`;

async function parsePage(text, pageIndex, totalPages, legend) {
  if (!text.trim()) return [];
  const full = `${PROMPT_BASE}

=== KARTEN-SPEZIFISCHE LEGENDE ===
${formatLegendForPrompt(legend)}

Text von Seite ${pageIndex} von ${totalPages} der Speisekarte:
${text}`;
  const body = await anthropic({
    model: SONNET,
    max_tokens: PAGE_MAX_TOKENS,
    messages: [{ role: "user", content: [{ type: "text", text: full }] }],
  });
  let modelText = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (modelText.startsWith("```")) modelText = modelText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(modelText);
    return Array.isArray(parsed) ? parsed : parsed.items ?? [];
  } catch {
    return [];
  }
}

// ─── PDF-Text-basierte Code-Extraktion pro Item ─────────────────────────

/** Normalisiert für Fuzzy-Match. Die LaFamiglia-PDF (und viele andere)
 *  nutzt Letter-Spacing/Tracking — pdfjs extrahiert dann jedes Zeichen
 *  einzeln mit Leerzeichen dazwischen ("T O M AT E N C R E M E S U P P E").
 *  Deshalb strippen wir hier ALLE Whitespace-Zeichen. Komma bleibt
 *  erhalten damit "10,19,18" nach dem Namen ablesbar bleibt. */
function normalizeForMatch(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9,\.]/g, "")
    .trim();
}

/** Sucht die erste Vorkommnis von `itemName` im normalisierten PDF-Text.
 *  Wenn die Rohform nicht matcht (z. B. Sonnet hat einen Kategorie-Prefix
 *  wie "Pizza" davorgesetzt, der im PDF-Text NICHT steht), versuchen wir
 *  progressiv mit gestrippten Prefix-Wörtern. Codes werden im 250-Zeichen-
 *  Fenster nach dem Namen gesucht — nicht zwingend direkt anschließend,
 *  weil Sonnet lange Item-Namen oft kürzt (z. B. "Rinder-Carpaccio" statt
 *  "Rinder-Carpaccio mit Rucola, Parmesan & Champignons"). Als "gültig"
 *  gilt ein Cluster nur wenn ALLE Codes darin in 1..29 liegen. */
function extractCodesForItem(itemName, pdfTextNorm) {
  const candidates = itemNameCandidates(itemName);
  for (const cand of candidates) {
    if (cand.length < 4) continue;
    const idx = pdfTextNorm.indexOf(cand);
    if (idx === -1) continue;
    const window = pdfTextNorm.slice(idx + cand.length, idx + cand.length + 250);
    // Alle Cluster im Fenster: ein oder mehrere Ziffern, komma-getrennt.
    // Muss von einem Nicht-Ziffer-Zeichen begrenzt sein oder am Ende stehen
    // (verhindert dass "8,50" aus "8,50€" mitgelesen wird — Preise werden
    // nach der Normalisierung zu "8,50" oder "850" und passen nicht ins
    // Legenden-Range).
    const clusterRe = /(?<![,\d])(\d+(?:,\d+)*)(?![,\d])/g;
    let match;
    while ((match = clusterRe.exec(window)) !== null) {
      const parts = match[1].split(",");
      if (!parts.every((p) => {
        const n = Number.parseInt(p, 10);
        return Number.isFinite(n) && n >= 1 && n <= 29 && p.length <= 2;
      })) continue;
      return { codes: parts, found: true, matchedAs: cand };
    }
    // Fenster durchsucht, keine gültigen Codes gefunden — Item existiert,
    // hat aber keine Fußnoten.
    return { codes: [], found: true, matchedAs: cand };
  }
  return { codes: [], found: false };
}

/** Baut Kandidaten für den Item-Namen: erst die volle normalisierte
 *  Version, dann progressiv das erste Wort abgestreift (fängt Sonnets
 *  Prefix-Ergänzungen wie "Pizza Tomatensauce, Käse" → im PDF steht
 *  nur "Tomatensauce, Käse" auf der Pizza-Seite). */
function itemNameCandidates(itemName) {
  const words = itemName.trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < Math.min(2, words.length - 1); i++) {
    out.push(normalizeForMatch(words.slice(i).join(" ")));
  }
  out.push(normalizeForMatch(itemName));
  return Array.from(new Set(out));
}

/** Erwartete Klassifikation aus Ground-Truth-Legende berechnen. */
function expectedFromCodes(codes) {
  const allergensSet = new Set();
  const additivesLabels = [];
  const missing = [];
  for (const c of codes) {
    const e = GROUND_TRUTH_LEGEND[c];
    if (!e) {
      missing.push(c);
      continue;
    }
    if (e.lmiv) allergensSet.add(e.lmiv);
    else additivesLabels.push(e.label);
  }
  const allergens = Array.from(allergensSet);
  const additives_text = additivesLabels.length ? `enthält ${additivesLabels.join(", ")}` : "";
  return { allergens, additives_text, missing };
}

// ─── Vergleichs-Utils ───────────────────────────────────────────────────
function arraysEqualUnordered(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  const na = [...a].map((x) => String(x).toLowerCase()).sort();
  const nb = [...b].map((x) => String(x).toLowerCase()).sort();
  if (na.length !== nb.length) return false;
  return na.every((v, i) => v === nb[i]);
}
function normalizedAdditives(text) {
  return (text ?? "")
    .toLowerCase()
    // "enthält X, enthält Y" (Sonnet-Format-Bug) und "enthält X, Y"
    // (erwartetes Format) sollen nach Normalisierung gleich sein.
    .replace(/enthält\s+/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

/** True wenn additives_text mehr als einen "enthält "-Präfix enthält.
 *  Signal für den Prompt-Format-Bug (Klassifikation ist korrekt, nur die
 *  Formatierung wiederholt "enthält"). */
function hasDuplicateEnthaltPrefix(text) {
  return ((text ?? "").toLowerCase().match(/enthält\s+/g) ?? []).length > 1;
}

// ─── Main ───────────────────────────────────────────────────────────────
console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
console.log(`║  VALIDATE MENU IMPORT                                           ║`);
console.log(`║  PDF: ${PDF_PATH.slice(-58).padEnd(58)}  ║`);
console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

const buf = await readFile(PDF_PATH);
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;

const pageTexts = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const text = content.items.map((x) => ("str" in x ? x.str : "")).join(" ").trim();
  pageTexts.push(text);
}

const fullText = pageTexts.filter((t) => t.trim().length > 0).join("\n\n");
const pdfTextNorm = normalizeForMatch(fullText);
console.log(`PDF: ${doc.numPages} Seiten, ${fullText.length} chars raw, ${pdfTextNorm.length} chars normalisiert\n`);

console.log(`─── LEGENDEN-EXTRAKTION (Haiku) ───`);
const legend = await extractLegend(fullText);
console.log(`legend.found=${legend.found}  entries=${Object.keys(legend.entries).length}\n`);

// Verifiziere Legende vs. Ground Truth (kleiner Sanity-Check)
const gtCodes = Object.keys(GROUND_TRUTH_LEGEND);
const extractedCodes = Object.keys(legend.entries ?? {});
const codesMissing = gtCodes.filter((c) => !extractedCodes.includes(c));
const codesExtra = extractedCodes.filter((c) => !gtCodes.includes(c));
console.log(`Legend-Sanity: ${extractedCodes.length}/${gtCodes.length} Codes erkannt`);
if (codesMissing.length) console.log(`  fehlt in Extraktion: ${codesMissing.join(", ")}`);
if (codesExtra.length)   console.log(`  zusätzlich in Extraktion: ${codesExtra.join(", ")}`);

console.log(`\n─── PER-PAGE PARSING (Sonnet, seq.) ───`);
const allItems = [];
for (let i = 0; i < pageTexts.length; i++) {
  const t = pageTexts[i];
  if (t.trim().length < MIN_PAGE_TEXT_CHARS) continue;
  try {
    const items = await parsePage(t, i + 1, pageTexts.length, legend);
    process.stdout.write(`  Seite ${i + 1}: ${items.length} Items\n`);
    allItems.push(...items);
  } catch (err) {
    process.stdout.write(`  Seite ${i + 1}: FAIL (${err.message.slice(0, 100)})\n`);
  }
}

// dedupe wie in Prod
const seen = new Set();
const merged = [];
for (const it of allItems) {
  const key = `${(it.name ?? "").trim().toLowerCase()}::${it.preis ?? 0}`;
  if (seen.has(key)) continue;
  seen.add(key);
  merged.push(it);
}

console.log(`\n─── VERGLEICH GROUND-TRUTH vs. IMPORT ───`);
console.log(`Items importiert:            ${merged.length}`);

let itemsWithCodes = 0;
let itemsWithoutCodes = 0;
let itemsCorrect = 0;
let itemsAllergensMismatch = 0;
let itemsAdditivesMismatch = 0;
let itemsBothMismatch = 0;
let itemsNotFoundInPdf = 0;
let itemsWithEnthaltDupe = 0;
const mismatches = [];

for (const item of merged) {
  const { codes, found } = extractCodesForItem(item.name, pdfTextNorm);
  if (!found) {
    itemsNotFoundInPdf++;
    continue;
  }
  if (codes.length === 0) {
    itemsWithoutCodes++;
    // Erwartung: allergens=[], additives_text=""
    const emptyAllergens = Array.isArray(item.allergens) && item.allergens.length === 0;
    const emptyAdditives = !item.additives_text || item.additives_text.trim() === "";
    if (emptyAllergens && emptyAdditives) {
      itemsCorrect++;
    } else {
      mismatches.push({
        name: item.name,
        codes: [],
        expected: { allergens: [], additives_text: "" },
        actual: { allergens: item.allergens ?? [], additives_text: item.additives_text ?? "" },
        needs_review: item.needs_review,
        reason: "Item hat keine Codes im PDF, aber Import hat allergens/additives befüllt",
      });
      if (!emptyAllergens && !emptyAdditives) itemsBothMismatch++;
      else if (!emptyAllergens) itemsAllergensMismatch++;
      else itemsAdditivesMismatch++;
    }
    continue;
  }
  itemsWithCodes++;
  const exp = expectedFromCodes(codes);
  const actualAllergens = Array.isArray(item.allergens) ? item.allergens : [];
  const actualAdditives = normalizedAdditives(item.additives_text);
  const expectedAdditives = normalizedAdditives(exp.additives_text);
  const allergensOK = arraysEqualUnordered(exp.allergens, actualAllergens);
  const additivesOK = actualAdditives === expectedAdditives;
  if (hasDuplicateEnthaltPrefix(item.additives_text)) itemsWithEnthaltDupe++;
  if (allergensOK && additivesOK) {
    itemsCorrect++;
  } else {
    mismatches.push({
      name: item.name,
      codes,
      expected: { allergens: exp.allergens, additives_text: exp.additives_text },
      actual: { allergens: actualAllergens, additives_text: item.additives_text ?? "" },
      needs_review: item.needs_review,
      missing_from_legend: exp.missing,
      allergensOK,
      additivesOK,
    });
    if (!allergensOK && !additivesOK) itemsBothMismatch++;
    else if (!allergensOK) itemsAllergensMismatch++;
    else itemsAdditivesMismatch++;
  }
}

const totalMatched = itemsWithCodes + itemsWithoutCodes;
const errorRate = totalMatched > 0 ? ((totalMatched - itemsCorrect) / totalMatched * 100).toFixed(1) : "0.0";
console.log(`  Items in PDF gefunden:     ${totalMatched} (nicht gefunden: ${itemsNotFoundInPdf})`);
console.log(`    → mit Codes im PDF:      ${itemsWithCodes}`);
console.log(`    → ohne Codes im PDF:     ${itemsWithoutCodes}`);
console.log(`\n  Korrekt extrahiert:        ${itemsCorrect}/${totalMatched}  (${(100 - Number.parseFloat(errorRate)).toFixed(1)} %)`);
console.log(`  Fehlerquote:               ${errorRate} %  (${mismatches.length} Items)`);
console.log(`    → nur allergens falsch:  ${itemsAllergensMismatch}`);
console.log(`    → nur additives falsch:  ${itemsAdditivesMismatch}`);
console.log(`    → beides falsch:         ${itemsBothMismatch}`);
console.log(`\n  Zusatz-Signal (Prompt-Format-Bug, unabhängig von der Fehlerquote):`);
console.log(`    → mit "enthält"-Duplikat: ${itemsWithEnthaltDupe} Items ("enthält X, enthält Y" statt "enthält X, Y")`);

if (mismatches.length) {
  console.log(`\n─── ABWEICHUNGEN (vollständig) ───`);
  for (const m of mismatches) {
    console.log(`\n• ${m.name}`);
    console.log(`  PDF-Codes: [${m.codes.join(", ")}]`);
    console.log(`  ERWARTET:  allergens=${JSON.stringify(m.expected.allergens)}  additives="${m.expected.additives_text}"`);
    console.log(`  IST:       allergens=${JSON.stringify(m.actual.allergens)}  additives="${m.actual.additives_text}"`);
    if (m.needs_review) console.log(`  (needs_review=true)`);
    if (m.missing_from_legend?.length) console.log(`  Codes NICHT in Ground-Truth-Legende: ${m.missing_from_legend.join(", ")}`);
    if (m.reason) console.log(`  Grund: ${m.reason}`);
  }
}

console.log(`\n═════════════════════════════════════════════════════════════════`);
console.log(`FAZIT: ${itemsCorrect} / ${totalMatched} Items korrekt (Fehlerquote ${errorRate} %)`);
console.log(`═════════════════════════════════════════════════════════════════\n`);
