/** Entfernt Tags/Skripte aus HTML für KI-Extraktion (kein DOM nötig). */
export function stripHtmlToPlainText(html: string): string {
  const noScript = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  const stripped = noScript.replace(/<[^>]+>/g, " ");
  return stripped.replace(/\s+/g, " ").trim();
}
