"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CYAN = "#00C2FF";
const MINT = "#34E89E";

const BENEFITS = [
  {
    icon: "📈",
    title: "Mehr Umsatz",
    text: "Gäste, die Bilder sehen, bestellen mehr. Bis zu 30 % höherer Bon.",
  },
  {
    icon: "⚡",
    title: "Immer aktuell",
    text: "Tagesangebot in Sekunden ändern. Kein Drucken, kein Warten.",
  },
  {
    icon: "🤖",
    title: "KI-Import",
    text: "Menü per Foto oder PDF hochladen. KI erkennt alle Gerichte automatisch.",
  },
  {
    icon: "🌍",
    title: "Mehrsprachig",
    text: "Deine Karte automatisch auf Deutsch, Englisch, Türkisch, Arabisch.",
  },
  {
    icon: "😊",
    title: "Zufriedenere Gäste",
    text: "Allergene, Zutaten, Bilder — alles auf einen Blick.",
  },
  {
    icon: "📊",
    title: "Einblicke",
    text: "Sieh, welche Gerichte deine Gäste am meisten interessieren.",
  },
] as const;

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
    <div
      className="relative min-h-screen overflow-x-hidden text-white"
      style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, rgba(13,148,136,0.35) 0%, transparent 55%), radial-gradient(90% 60% at 100% 40%, rgba(0,194,255,0.12) 0%, transparent 50%), linear-gradient(180deg, #030a0c 0%, #050f12 40%, #061418 100%)",
      }}
    >
      <header
        className={`sticky top-0 z-50 border-b transition-[background-color,backdrop-filter,border-color] duration-300 ${
          navSolid
            ? "border-white/10 bg-[#030a0c]/75 backdrop-blur-xl"
            : "border-transparent bg-transparent backdrop-blur-md"
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

      <main>
        {/* HERO */}
        <section className="relative px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-14 md:pt-20">
          <div
            className="pointer-events-none absolute -right-24 -top-32 h-[min(100vw,560px)] w-[min(100vw,560px)] rounded-full opacity-[0.55] sm:-right-16 sm:top-[-6rem]"
            style={{
              background:
                "conic-gradient(from 0deg at 50% 50%, #0d9488 0deg, #e2f7ff 120deg, #ff5c1a 220deg, #00c2ff 300deg, #0d9488 360deg)",
              filter: "blur(80px)",
              animation: "qrave-mesh-spin 22s linear infinite",
              willChange: "transform",
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl">
            <p
              className="mb-5 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs"
              style={{
                borderColor: "rgba(45,212,191,0.35)",
                background: "rgba(13,148,136,0.15)",
                color: "#5eead4",
              }}
            >
              Für Restaurants · 100% kostenlos
            </p>
            <h1 className="max-w-4xl text-[2.1rem] font-bold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl md:leading-[1.08]">
              Die schönste Speisekarte deines Lebens.
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(105deg, ${CYAN} 0%, #ffffff 45%, ${CYAN} 100%)`,
                }}
              >
                Kostenlos.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              QR-Code scannen — fertig. Kein App-Download, kein Login. Deine Gäste sehen dein Menü sofort.
            </p>
            <a
              href="#kontakt"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black transition hover:bg-slate-100 sm:text-base"
            >
              Jetzt kostenlos starten
              <span aria-hidden>→</span>
            </a>
          </div>
        </section>

        {/* ZAHLEN */}
        <section className="border-y border-white/10 bg-black/20 px-4 py-14 backdrop-blur-sm sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-8">
            <div>
              <p className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">bis zu 30%</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
                Mehr Bestellungen durch digitale Karte
                <span className="mt-2 block text-xs text-slate-500">Quelle: Toast-POS-Studie</span>
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">0€</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
                Kosten für dich — heute und für immer
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">360€/Jahr</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
                sparen vs. andere Anbieter
              </p>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section id="vorteile" className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold sm:text-3xl">Alles, was dein Lokal braucht</h2>
            <p className="mt-2 max-w-2xl text-slate-400">Mehr Umsatz, weniger Aufwand — für dich und deine Gäste.</p>
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {BENEFITS.map((b) => (
                <li
                  key={b.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition hover:border-white/20"
                >
                  <span className="text-2xl" aria-hidden>
                    {b.icon}
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-white">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{b.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* VERGLEICH */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold sm:text-3xl">Andere kosten. Qrave nicht.</h2>
            <p className="mt-2 text-slate-400">Transparent — ohne Kleingedrucktes.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Andere Anbieter</p>
                <ul className="mt-5 space-y-3 text-sm text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-slate-600" aria-hidden>
                      ·
                    </span>
                    Ab ca. 360€ pro Jahr
                  </li>
                  <li className="flex gap-2">
                    <span className="text-slate-600" aria-hidden>
                      ·
                    </span>
                    Monatliche Gebühren
                  </li>
                  <li className="flex gap-2">
                    <span className="text-slate-600" aria-hidden>
                      ·
                    </span>
                    Oft Vertragsbindung
                  </li>
                </ul>
              </div>
              <div
                className="rounded-2xl border p-6 sm:p-8"
                style={{
                  borderColor: "rgba(52,232,158,0.35)",
                  background: "linear-gradient(145deg, rgba(52,232,158,0.08) 0%, rgba(0,194,255,0.06) 100%)",
                }}
              >
                <p className="text-sm font-bold uppercase tracking-wider" style={{ color: MINT }}>
                  Qrave
                </p>
                <ul className="mt-5 space-y-3 text-sm text-slate-200">
                  <li className="flex items-start gap-2">
                    <span style={{ color: MINT }} aria-hidden>
                      ✓
                    </span>
                    0€ — immer
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: MINT }} aria-hidden>
                      ✓
                    </span>
                    Keine versteckten Gebühren
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: MINT }} aria-hidden>
                      ✓
                    </span>
                    Kein Vertrag
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SCHRITTE */}
        <section className="border-t border-white/10 bg-black/15 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold sm:text-3xl">In 3 Schritten live</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
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
                <li key={step.n} className="relative flex gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold"
                    style={{
                      background: `linear-gradient(135deg, ${CYAN}33, rgba(13,148,136,0.35))`,
                      color: CYAN,
                    }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* KONTAKT */}
        <section id="kontakt" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl font-bold sm:text-3xl">Bereit? Wir melden uns innerhalb von 24 Stunden.</h2>
            <p className="mt-2 text-slate-400">Fülle das Formular aus — unverbindlich und kostenlos.</p>

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

            <p className="mt-8 text-center text-xs text-slate-500">
              Bereits Zugang?{" "}
              <Link href="/login" className="font-semibold text-cyan-400 underline-offset-2 hover:underline">
                Zum Login
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-slate-500 sm:px-6">
        <p>© {new Date().getFullYear()} Qrave · Digitale Speisekarte</p>
      </footer>
    </div>
  );
}
