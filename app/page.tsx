"use client";

import Link from "next/link";
import {
  BarChart2,
  Check,
  Globe,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const CYAN = "#00C2FF";
const ORANGE = "#FF5C1A";
const MINT = "#34E89E";
const BG = "#050508";

const BENEFITS: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: TrendingUp,
    title: "Mehr Umsatz",
    text: "Gäste, die Bilder sehen, bestellen mehr. Bis zu 30 % höherer Bon.",
  },
  {
    Icon: Zap,
    title: "Immer aktuell",
    text: "Tagesangebot in Sekunden ändern. Kein Drucken, kein Warten.",
  },
  {
    Icon: Sparkles,
    title: "KI-Import",
    text: "Menü per Foto oder PDF hochladen. KI erkennt alle Gerichte automatisch.",
  },
  {
    Icon: Globe,
    title: "Mehrsprachig",
    text: "Deine Karte automatisch auf Deutsch, Englisch, Türkisch, Arabisch.",
  },
  {
    Icon: Star,
    title: "Zufriedenere Gäste",
    text: "Allergene, Zutaten, Bilder — alles auf einen Blick.",
  },
  {
    Icon: BarChart2,
    title: "Einblicke",
    text: "Sieh, welche Gerichte deine Gäste am meisten interessieren.",
  },
];

const STATS = [
  { value: "30%", label: "+Umsatz durch digitale Karte" },
  { value: "0€", label: "Kosten für dich — immer" },
  { value: "360€", label: "sparen vs. andere Anbieter pro Jahr" },
  { value: "3min", label: "Bis deine Karte online ist" },
] as const;

const TRUST_BRANDS = ["Heineken", "Red Bull", "Coca-Cola"] as const;

export default function Home() {
  const [navSolid, setNavSolid] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [formError, setFormError] = useState("");

  const onScroll = useCallback(() => {
    setNavSolid(window.scrollY > 12);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => onScroll());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, [onScroll]);

  async function onSubmitContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setFormStatus("loading");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      restaurant_name: String(fd.get("restaurant_name") ?? ""),
      telefon: String(fd.get("telefon") ?? ""),
      nachricht: String(fd.get("nachricht") ?? ""),
    };
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Senden fehlgeschlagen.");
        setFormStatus("error");
        return;
      }
      setFormStatus("success");
      e.currentTarget.reset();
    } catch {
      setFormError("Netzwerkfehler. Bitte später erneut versuchen.");
      setFormStatus("error");
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden text-white" style={{ backgroundColor: BG }}>
      <div className="relative z-10">
        <header
          className={`sticky top-0 z-50 border-b transition-[background-color,backdrop-filter,border-color] duration-300 ${
            navSolid
              ? "border-white/10 bg-[#050508]/85 backdrop-blur-xl"
              : "border-transparent bg-[#050508]/40 backdrop-blur-md"
          }`}
        >
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-0.5 text-xl font-extrabold tracking-tight">
              <span className="text-white">q</span>
              <span style={{ color: CYAN }}>rave</span>
            </Link>
            <a
              href="#kontakt"
              className="shrink-0 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-slate-100 sm:px-5"
            >
              Kostenlos starten
            </a>
          </nav>
        </header>

        <main className="text-left">
          {/* HERO */}
          <section className="relative overflow-hidden px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16 md:pb-32 md:pt-20">
            <div className="relative mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:gap-8">
              <div className="relative z-10 max-w-2xl lg:max-w-[min(100%,36rem)] lg:flex-1">
                <p
                  className="mb-6 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-300/90 sm:text-xs"
                  style={{
                    borderColor: "rgba(0,194,255,0.35)",
                    background: "rgba(0,194,255,0.08)",
                  }}
                >
                  Für Restaurants · 100% kostenlos
                </p>
                <h1 className="text-[2.35rem] font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-[3.35rem] xl:text-[3.75rem]">
                  <span className="block">Die schönste Speisekarte</span>
                  <span className="block">deines Lebens.</span>
                  <span
                    className="mt-2 block bg-clip-text text-transparent sm:mt-3"
                    style={{
                      backgroundImage: `linear-gradient(100deg, ${CYAN} 0%, #7dd3fc 35%, ${ORANGE} 100%)`,
                    }}
                  >
                    Kostenlos.
                  </span>
                </h1>
                <p className="mt-6 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
                  QR-Code scannen — fertig. Kein App-Download, kein Login. Deine Gäste sehen dein Menü sofort.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    href="#kontakt"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black transition hover:bg-slate-100 sm:text-base"
                  >
                    Jetzt kostenlos starten
                    <span aria-hidden>→</span>
                  </a>
                  <a
                    href="https://qrave.menu/qrave-demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border px-7 py-3.5 text-sm font-bold transition hover:bg-white/5 sm:text-base"
                    style={{ borderColor: CYAN, color: CYAN }}
                  >
                    Beispiel ansehen
                  </a>
                </div>

                <div
                  className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-white/10 pt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:gap-x-12 sm:text-xs"
                  aria-label="Bekannte Marken"
                >
                  {TRUST_BRANDS.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              </div>

              <div
                className="pointer-events-none relative min-h-[260px] flex-1 sm:min-h-[320px] lg:min-h-[min(520px,50vh)]"
                aria-hidden
              >
                <div className="qrave-hero-glow absolute left-1/2 top-1/2 -translate-x-[20%] -translate-y-1/2 sm:-translate-x-[10%] lg:left-auto lg:right-[-12%] lg:translate-x-0 xl:right-[-4%]" />
              </div>
            </div>
          </section>

          {/* STATS */}
          <section className="border-y border-white/10 px-4 py-24 sm:px-6">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
              {STATS.map((s) => (
                <div
                  key={s.value}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 sm:px-5 sm:py-6"
                >
                  <p className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: CYAN }}>
                    {s.value}
                  </p>
                  <p className="mt-3 text-xs leading-snug text-slate-400 sm:text-sm">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* BENEFITS */}
          <section id="vorteile" className="px-4 py-24 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Alles was dein Restaurant braucht</h2>
              <p className="mt-3 max-w-2xl text-slate-400">Mehr Umsatz, weniger Aufwand — für dich und deine Gäste.</p>
              <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {BENEFITS.map(({ Icon, title, text }) => (
                  <li
                    key={title}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-sm transition hover:border-white/15 sm:p-7"
                  >
                    <Icon
                      className="shrink-0"
                      size={36}
                      strokeWidth={1.75}
                      aria-hidden
                      style={{ color: CYAN }}
                    />
                    <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* VERGLEICH */}
          <section className="px-4 py-24 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Andere kosten. Qrave nicht.</h2>
              <p className="mt-3 text-slate-400">Transparent — ohne Kleingedrucktes.</p>
              <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Andere Anbieter</p>
                  <ul className="mt-6 space-y-4 text-sm text-slate-400">
                    <li>Ab ca. 360€ pro Jahr</li>
                    <li>Monatliche Gebühren</li>
                    <li>Oft Vertragsbindung</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 sm:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: MINT }}>
                    Qrave
                  </p>
                  <ul className="mt-6 space-y-4 text-sm text-slate-200">
                    <li className="flex items-center gap-3">
                      <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} style={{ color: MINT }} aria-hidden />
                      0€ — immer
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} style={{ color: MINT }} aria-hidden />
                      Keine versteckten Gebühren
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} style={{ color: MINT }} aria-hidden />
                      Kein Vertrag
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* SCHRITTE */}
          <section className="border-t border-white/10 bg-white/[0.02] px-4 py-24 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">In 3 Schritten live</h2>
              <ol className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
                {[
                  {
                    n: "1",
                    title: "Wir kommen zu dir",
                    text: "Wir richten deine digitale Karte kostenlos ein.",
                  },
                  {
                    n: "2",
                    title: "QR-Code an den Tisch",
                    text: "Gäste scannen und sehen sofort dein Menü.",
                  },
                  {
                    n: "3",
                    title: "Fertig",
                    text: "Änderungen jederzeit selbst vornehmen.",
                  },
                ].map((step) => (
                  <li
                    key={step.n}
                    className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-[#050508] p-8 sm:p-10 md:p-12"
                  >
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 text-2xl font-black tracking-tight sm:h-24 sm:w-24 sm:text-3xl"
                      style={{
                        borderColor: "rgba(0,194,255,0.45)",
                        background: `linear-gradient(145deg, rgba(0,194,255,0.18) 0%, rgba(255,92,26,0.12) 100%)`,
                        color: CYAN,
                        boxShadow: "0 0 48px rgba(0,194,255,0.12)",
                      }}
                    >
                      {step.n}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{step.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* KONTAKT */}
          <section id="kontakt" className="scroll-mt-20 px-4 py-24 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="max-w-xl">
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Bereit? Wir melden uns innerhalb von 24 Stunden.</h2>
              <p className="mt-3 text-slate-400">Fülle das Formular aus — unverbindlich und kostenlos.</p>

              <form className="mt-10 space-y-4" onSubmit={onSubmitContact}>
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-slate-300">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2"
                    placeholder="Dein Name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-restaurant"
                    className="mb-1.5 block text-sm font-semibold text-slate-300"
                  >
                    Restaurant-Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="contact-restaurant"
                    name="restaurant_name"
                    type="text"
                    required
                    autoComplete="organization"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2"
                    placeholder="Name deines Lokals"
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-semibold text-slate-300">
                    Telefon <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="contact-phone"
                    name="telefon"
                    type="tel"
                    autoComplete="tel"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2"
                    placeholder="+49 …"
                  />
                </div>
                <div>
                  <label htmlFor="contact-msg" className="mb-1.5 block text-sm font-semibold text-slate-300">
                    Nachricht <span className="text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="contact-msg"
                    name="nachricht"
                    rows={4}
                    className="w-full resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2"
                    placeholder="Wie können wir helfen?"
                  />
                </div>

                {formStatus === "error" && formError ? (
                  <p className="text-sm font-medium text-red-400" role="alert">
                    {formError}
                  </p>
                ) : null}
                {formStatus === "success" ? (
                  <p className="text-sm font-medium" style={{ color: MINT }}>
                    Danke! Wir melden uns bald bei dir.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={formStatus === "loading"}
                  className="w-full rounded-full bg-white py-3.5 text-sm font-bold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                >
                  {formStatus === "loading" ? "Wird gesendet…" : "Kostenlos anfragen →"}
                </button>
              </form>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl text-left text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Qrave · Digitale Speisekarte</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
