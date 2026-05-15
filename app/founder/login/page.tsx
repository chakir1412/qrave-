"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const ui = {
  or: "#FF5C1A",
  glass: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.11)",
  tx: "#F9F9F9",
  mu: "rgba(249,249,249,0.62)",
} as const;

export default function FounderLoginPage() {
  const [email, setEmail] = useState("");
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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

          {!sent ? (
            <>
              <label className="mt-5 block text-xs font-semibold" style={{ color: ui.mu }}>
                E-Mail für Magic Link
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void signInWithMagicLink();
                }}
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
                disabled={loadingMagic}
                className="mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${ui.or}, #FF7A3D)` }}
              >
                {loadingMagic ? "Sende Magic Link …" : "Magic Link senden"}
              </button>
            </>
          ) : (
            <div
              className="mt-5 rounded-xl border px-3.5 py-3 text-sm"
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
