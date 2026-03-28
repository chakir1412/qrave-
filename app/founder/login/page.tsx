"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const ui = {
  bg: "#070818",
  or: "#FF5C1A",
  glass: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.11)",
  tx: "#F9F9F9",
  mu: "rgba(249,249,249,0.62)",
} as const;

export default function FounderLoginPage() {
  const [email, setEmail] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<"apple" | "google" | null>(null);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signInWithProvider(provider: "apple" | "google") {
    setError(null);
    setLoadingProvider(provider);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/founder/auth/callback`,
        },
      });
      if (oauthErr) setError(oauthErr.message);
    } finally {
      setLoadingProvider(null);
    }
  }

  async function signInWithMagicLink() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Bitte eine E-Mail eingeben.");
      return;
    }
    setError(null);
    setLoadingMagic(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: `${window.location.origin}/founder/auth/callback`,
        },
      });
      if (otpErr) {
        setError(otpErr.message);
        return;
      }
      setSent(true);
    } finally {
      setLoadingMagic(false);
    }
  }

  return (
    <main
      className="relative min-h-screen"
      style={{ backgroundColor: "transparent", background: "transparent" }}
    >
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-8 pt-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <img
            src="/qrave-logo.png"
            alt="Qrave"
            style={{
              width: "72px",
              height: "72px",
              filter: "invert(1) brightness(2)",
            }}
          />
          <span
            className="mt-2 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: ui.or, borderColor: ui.border, backgroundColor: ui.glass }}
          >
            Founder Access
          </span>
        </div>

        <section
          className="mt-auto rounded-[24px] border p-5"
          style={{
            backgroundColor: ui.glass,
            borderColor: ui.border,
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: ui.or }}>
            Privater Bereich
          </p>
          <h1 className="mt-2 text-[30px] font-black leading-[1.05]" style={{ color: ui.tx }}>
            Command Center
          </h1>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void signInWithProvider("apple")}
              disabled={loadingProvider !== null || loadingMagic}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-60"
              style={{ borderColor: ui.border, color: ui.tx, backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {loadingProvider === "apple" ? "Apple lädt …" : "Mit Apple fortfahren"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void signInWithProvider("google")}
              disabled={loadingProvider !== null || loadingMagic}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-60"
              style={{ borderColor: ui.border, color: ui.tx, backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {loadingProvider === "google" ? "Google lädt …" : "Mit Google fortfahren"}
              </span>
            </button>
          </div>

          {!sent ? (
            <>
              <div className="my-4 h-px" style={{ backgroundColor: ui.border }} />
              <label className="text-xs font-semibold" style={{ color: ui.mu }}>
                E-Mail für Magic Link
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@firma.de"
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border px-3.5 py-3 text-sm outline-none"
                style={{
                  color: ui.tx,
                  borderColor: ui.border,
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              />
              <button
                type="button"
                onClick={() => void signInWithMagicLink()}
                disabled={loadingMagic || loadingProvider !== null}
                className="mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${ui.or}, #FF7A3D)` }}
              >
                {loadingMagic ? "Sende Magic Link …" : "Magic Link senden"}
              </button>
            </>
          ) : (
            <div
              className="mt-4 rounded-xl border px-3.5 py-3 text-sm"
              style={{ borderColor: ui.border, backgroundColor: "rgba(255,255,255,0.04)", color: ui.tx }}
            >
              Magic Link gesendet. Bitte E-Mails prüfen und den Login-Link öffnen.
            </div>
          )}

          <div
            className="mt-4 rounded-xl border px-3.5 py-3 text-xs leading-relaxed"
            style={{ borderColor: "rgba(255,92,26,0.42)", color: ui.or, backgroundColor: "rgba(255,92,26,0.08)" }}
          >
            Zugriff nur für autorisierte Founder-Accounts. Unbekannte Sessions werden abgewiesen.
          </div>

          {error ? (
            <p className="mt-3 text-xs font-semibold" style={{ color: "#FF4B6E" }}>
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-center text-[11px] font-semibold" style={{ color: ui.mu }}>
            Kein Account? Kein Zugang.
          </p>
        </section>
      </div>

    </main>
  );
}
