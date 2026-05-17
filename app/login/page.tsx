"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ACCENT = "#9333ea";
const ACCENT_LIGHT = "#7c3aed";
const ACCENT_SOFT = "#a855f7";
const BG = "#06040e";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const FONT_ROBOTO = "var(--font-roboto), system-ui, sans-serif";
const FONT_DM = "var(--font-dm-sans), system-ui, sans-serif";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-dvh items-center justify-center"
          style={{ background: BG, color: "rgba(255,255,255,0.5)", fontFamily: FONT_DM }}
        >
          Lädt …
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthErr) setError(oauthErr.message);
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function signInWithPasswordSubmit() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Bitte eine E-Mail eingeben.");
      return;
    }
    if (!password) {
      setError("Bitte das Passwort eingeben.");
      return;
    }
    setError(null);
    setLoadingPassword(true);
    try {
      const { error: pwErr } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (pwErr) {
        setError("E-Mail oder Passwort falsch");
        return;
      }
      router.replace(redirect);
    } finally {
      setLoadingPassword(false);
    }
  }

  return (
    <main
      className="relative isolate min-h-dvh overflow-hidden"
      style={{ background: BG, color: "#fff", fontFamily: FONT_DM }}
    >
      <PurpleBeams />

      <style>{`
        .lg-input {
          width: 100%;
          background: ${CARD};
          border: 1px solid ${BORDER};
          border-radius: 12px;
          padding: 12px 16px;
          color: #fff;
          font-size: 16px;
          font-family: ${FONT_DM};
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lg-input::placeholder { color: rgba(255,255,255,0.35); }
        .lg-input:focus {
          border-color: ${ACCENT};
          box-shadow: 0 0 0 3px rgba(147,51,234,0.15);
        }

        .lg-cta {
          background: linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT});
          color: #fff;
          border-radius: 12px;
          padding: 14px 24px;
          font-family: ${FONT_DM};
          font-weight: 500;
          font-size: 15px;
          box-shadow: 0 0 24px rgba(147,51,234,0.4);
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          cursor: pointer;
          border: none;
        }
        .lg-cta:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 40px rgba(147,51,234,0.6);
        }
        .lg-cta:active:not(:disabled) { transform: translateY(0); }
        .lg-cta:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

        .lg-google {
          width: 100%;
          background: ${CARD};
          border: 1px solid ${BORDER};
          border-radius: 12px;
          padding: 12px 16px;
          color: #fff;
          font-family: ${FONT_DM};
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .lg-google:hover:not(:disabled) {
          border-color: rgba(147,51,234,0.4);
          background: rgba(147,51,234,0.04);
        }
        .lg-google:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-10">
        <div className="mb-10 text-center">
          <span
            className="text-[20px] tracking-[0.04em]"
            style={{ color: ACCENT, fontFamily: FONT_ROBOTO, fontWeight: 900 }}
          >
            QRAVE
          </span>
        </div>

        <section
          className="mt-auto rounded-[20px] border p-6"
          style={{
            background: CARD,
            borderColor: BORDER,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          }}
        >
          <p
            className="uppercase"
            style={{
              fontFamily: FONT_DM,
              fontSize: 11,
              letterSpacing: "0.16em",
              color: "rgba(147,51,234,0.7)",
              fontWeight: 600,
            }}
          >
            Restaurant Login
          </p>
          <h1
            className="mt-2"
            style={{
              fontFamily: FONT_ROBOTO,
              fontWeight: 900,
              fontSize: 30,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            Willkommen zurück
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "rgba(255,255,255,0.5)", fontFamily: FONT_DM, lineHeight: 1.5 }}
          >
            Melde dich an um deine Speisekarte zu verwalten.
          </p>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={loadingGoogle || loadingPassword}
            className="lg-google mt-6"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loadingGoogle ? "Google lädt …" : "Mit Google fortfahren"}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            <span
              className="uppercase"
              style={{
                fontFamily: FONT_DM,
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 500,
              }}
            >
              oder
            </span>
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
          </div>

          <label
            className="block uppercase"
            style={{
              fontFamily: FONT_DM,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.5)",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            E-Mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@firma.de"
            autoComplete="email"
            className="lg-input"
          />

          <label
            className="block uppercase"
            style={{
              fontFamily: FONT_DM,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.5)",
              fontWeight: 500,
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void signInWithPasswordSubmit();
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            className="lg-input"
          />

          <button
            type="button"
            onClick={() => void signInWithPasswordSubmit()}
            disabled={loadingPassword || loadingGoogle}
            className="lg-cta mt-5 w-full"
          >
            {loadingPassword ? "Anmeldung läuft …" : "Einloggen"}
          </button>

          <div
            className="mt-5 rounded-[10px] px-4 py-3"
            style={{
              background: "rgba(147,51,234,0.08)",
              border: "1px solid rgba(147,51,234,0.2)",
              color: "rgba(255,255,255,0.5)",
              fontFamily: FONT_DM,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            DSGVO-konforme Verarbeitung. Deine Daten werden sicher und zweckgebunden gespeichert.
          </div>

          {error ? (
            <p
              className="mt-4 text-center"
              style={{
                color: "#ff8a8a",
                fontFamily: FONT_DM,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </p>
          ) : null}

          <p
            className="mt-5 text-center"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontFamily: FONT_DM,
              fontSize: 13,
            }}
          >
            Noch kein Account?{" "}
            <a
              href="/registrieren"
              style={{ color: ACCENT_SOFT, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Kostenlos registrieren
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

/* ---------- Beams (oben links, lila radialGradient) ---------- */

function PurpleBeams() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 1200 800"
    >
      <defs>
        <radialGradient id="lg-beam-a" cx="0" cy="0" r="0.7">
          <stop offset="0%" stopColor="rgba(147,51,234,0.45)" />
          <stop offset="40%" stopColor="rgba(124,58,237,0.18)" />
          <stop offset="100%" stopColor="rgba(6,4,14,0)" />
        </radialGradient>
        <radialGradient id="lg-beam-b" cx="0.2" cy="0.1" r="0.5">
          <stop offset="0%" stopColor="rgba(168,85,247,0.3)" />
          <stop offset="100%" stopColor="rgba(6,4,14,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="800" fill="url(#lg-beam-a)" />
      <rect x="0" y="0" width="1200" height="800" fill="url(#lg-beam-b)" />
    </svg>
  );
}
