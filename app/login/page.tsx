"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const RED = "#C0392B";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "Ungültige E-Mail oder Passwort." : err.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#1a1a1a] text-center mb-1">
          Restaurant-Dashboard
        </h1>
        <p className="text-sm text-[#6b7280] text-center mb-6">
          Melde dich an, um deine Speisekarte zu verwalten.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#374151] mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-[#1a1a1a] focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
              placeholder="alex@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#374151] mb-1">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-[#1a1a1a] focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-white font-medium transition-colors disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            {loading ? "Wird angemeldet…" : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
