"use client";

import { useEffect, useState } from "react";
import type { DashboardRestaurant } from "../types";
import { LOCALE_LABEL, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";

type Props = {
  restaurant: DashboardRestaurant;
  onToast: (msg: string) => void;
  onPatchRestaurant: (patch: { active_languages?: string[] }) => Promise<void>;
};

export function KiFeaturesContent({ restaurant, onToast, onPatchRestaurant }: Props) {
  const [translateBusy, setTranslateBusy] = useState(false);
  const [generateName, setGenerateName] = useState("");
  const [generateCategory, setGenerateCategory] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);

  // Beim Mount: wenn der URL-Hash #uebersetzen ist, dorthin scrollen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#uebersetzen") {
      document.getElementById("uebersetzen")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  async function handleGenerate() {
    const name = generateName.trim();
    if (generateBusy || name.length === 0) return;
    setGenerateBusy(true);
    setGeneratedText(null);
    try {
      const res = await fetch("/api/dashboard/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          name,
          kategorie: generateCategory.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; description?: string; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.description) {
        onToast(json?.error ?? "Konnte keine Beschreibung generieren");
        return;
      }
      setGeneratedText(json.description);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Fehlgeschlagen");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function handleTranslate() {
    if (translateBusy) return;
    setTranslateBusy(true);
    try {
      const res = await fetch("/api/dashboard/translate-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; translatedFields?: number; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        onToast(json?.error ?? "Übersetzung fehlgeschlagen");
        return;
      }
      const n = json.translatedFields ?? 0;
      onToast(n > 0 ? `✓ ${n} Texte übersetzt` : "✓ Alles aktuell");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Übersetzung fehlgeschlagen");
    } finally {
      setTranslateBusy(false);
    }
  }

  const activeLanguages = restaurant.active_languages ?? ["de"];
  const others = SUPPORTED_LOCALES.filter((l) => l !== "de");
  const hasOther = others.some((l) => activeLanguages.includes(l));

  function toggleLocale(locale: SupportedLocale) {
    if (locale === "de") return;
    const has = activeLanguages.includes(locale);
    const next = has ? activeLanguages.filter((l) => l !== locale) : [...activeLanguages, locale];
    const ordered = SUPPORTED_LOCALES.filter((l) => next.includes(l));
    void onPatchRestaurant({ active_languages: ordered });
  }

  return (
    <div className="space-y-4">
      <header className="mb-2">
        <h2 className="qrave-font-display text-[24px] font-black leading-tight tracking-tight">
          KI-<span style={{ color: "var(--qrave-accent-strong)" }}>Features</span>
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Beschreibungen automatisch generieren und Karte in 6 Sprachen übersetzen.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FeatureCard
          icon="fa-solid fa-wand-magic-sparkles"
          title="Beschreibung generieren"
          subtitle="Claude Haiku schreibt eine appetitliche Beschreibung (max. 200 Zeichen) zu jedem Gericht."
        >
          <div className="mt-4 space-y-2.5">
            <input
              value={generateName}
              onChange={(e) => setGenerateName(e.target.value)}
              placeholder="Gerichtname (z. B. Wiener Schnitzel)"
              className="w-full rounded-[11px] border bg-transparent px-3 py-2.5 text-[13px] outline-none"
              style={{ borderColor: "var(--qrave-dash-border)", color: "#f2f2f2" }}
            />
            <input
              value={generateCategory}
              onChange={(e) => setGenerateCategory(e.target.value)}
              placeholder="Kategorie (optional)"
              className="w-full rounded-[11px] border bg-transparent px-3 py-2.5 text-[13px] outline-none"
              style={{ borderColor: "var(--qrave-dash-border)", color: "#f2f2f2" }}
            />
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generateBusy || generateName.trim().length === 0}
              className="w-full rounded-[10px] py-[12px] text-[13px] font-bold transition disabled:opacity-50"
              style={{
                background: "var(--qrave-accent-gradient)",
                color: "#fff",
                boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
              }}
            >
              {generateBusy ? "✨ Generiert …" : "✨ Beschreibung generieren"}
            </button>
            {generatedText ? (
              <div
                className="rounded-[11px] border px-3.5 py-3 text-[13px]"
                style={{
                  borderColor: "color-mix(in srgb, var(--qrave-accent) 25%, transparent)",
                  background: "color-mix(in srgb, var(--qrave-accent) 8%, transparent)",
                }}
              >
                {generatedText}
              </div>
            ) : (
              <p className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                Tipp: Beim Bearbeiten eines Gerichts erscheint der Button automatisch, wenn das Beschreibungs-Feld leer ist.
              </p>
            )}
          </div>
        </FeatureCard>

        <FeatureCard
          icon="fa-solid fa-language"
          title="Karte übersetzen"
          subtitle="Sprachen aktivieren → DeepL übersetzt fehlende Texte. Bestehende Übersetzungen werden nie überschrieben."
          id="uebersetzen"
        >
          <div className="mt-4 space-y-1.5">
            {others.map((locale) => {
              const active = activeLanguages.includes(locale);
              return (
                <div
                  key={locale}
                  className="flex items-center justify-between rounded-[11px] border px-3.5 py-2.5"
                  style={{ borderColor: "var(--qrave-dash-border)", background: "rgba(255,255,255,0.03)" }}
                >
                  <span className="text-[13px] font-medium">{LOCALE_LABEL[locale]}</span>
                  <button
                    type="button"
                    onClick={() => toggleLocale(locale)}
                    className="relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
                    style={{ background: active ? "var(--qrave-accent)" : "rgba(255,255,255,0.12)" }}
                    aria-label={active ? `${LOCALE_LABEL[locale]} deaktivieren` : `${LOCALE_LABEL[locale]} aktivieren`}
                  >
                    <span
                      className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
                      style={{ left: active ? "calc(100% - 19px)" : "3px" }}
                    />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => void handleTranslate()}
              disabled={translateBusy || !hasOther}
              className="mt-3 w-full rounded-[10px] py-[12px] text-[13px] font-bold transition disabled:opacity-50"
              style={{
                background: hasOther && !translateBusy ? "var(--qrave-accent-gradient)" : "rgba(255,255,255,0.08)",
                color: hasOther && !translateBusy ? "#fff" : "rgba(242,242,242,0.5)",
                boxShadow: hasOther && !translateBusy ? "0 6px 20px rgba(147,51,234,0.4)" : "none",
              }}
            >
              {translateBusy ? "Übersetzt …" : "Speisekarte übersetzen"}
            </button>
          </div>
        </FeatureCard>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  subtitle,
  children,
  id,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="rounded-[16px] border p-6"
      style={{ background: "var(--qrave-dash-surface)", borderColor: "var(--qrave-dash-border)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: "color-mix(in srgb, var(--qrave-accent) 18%, transparent)",
            color: "var(--qrave-accent-strong)",
          }}
        >
          <i className={`${icon} text-[16px]`} />
        </div>
        <div>
          <div className="qrave-font-display text-[15px] font-bold">{title}</div>
          <p className="mt-0.5 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
