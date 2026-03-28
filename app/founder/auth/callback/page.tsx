"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function FounderAuthCallbackPage() {
  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      router.replace("/founder/login?error=auth");
      return;
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const searchParams = new URLSearchParams(window.location.search);
    const next = searchParams.get("next") ?? "/founder";
    const code = searchParams.get("code");

    const go = (path: string) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      router.replace(path);
    };

    if (code) {
      void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          go("/founder/login?error=auth");
          return;
        }
        go(next);
      });
      return;
    }

    const rawHash = window.location.hash;
    const hashParams = new URLSearchParams(
      rawHash.startsWith("#") ? rawHash.slice(1) : rawHash,
    );
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      void supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ error }) => {
          if (!error) {
            go(next);
          } else {
            go("/founder/login?error=auth");
          }
        });
      return;
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        go(next);
      } else {
        go("/founder/login?error=auth");
      }
    });
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070818",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.6)",
        fontFamily: "Roboto, sans-serif",
        fontSize: "15px",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          border: "2px solid rgba(255,92,26,0.3)",
          borderTop: "2px solid #FF5C1A",
          animation: "spin 0.8s linear infinite",
        }}
      />
      Einloggen...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
