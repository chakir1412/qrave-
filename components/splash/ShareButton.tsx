"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  restaurantName: string;
  slug: string;
};

/** Teilen-Button mit Web-Share-API + Clipboard-Fallback.
 *  Auf iOS/Android öffnet `navigator.share` den nativen Sheet
 *  (WhatsApp, Mail, AirDrop …). Auf Desktops ohne Share-API wird
 *  die URL in die Zwischenablage kopiert + Toast „Link kopiert". */
export default function ShareButton({ restaurantName, slug }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/${slug}`
        : `https://qrave.menu/${slug}`;
    const shareData = {
      title: restaurantName,
      text: `Speisekarte von ${restaurantName}`,
      url,
    };

    // Web Share API verfügbar? (iOS Safari, Android Chrome, Edge mobile)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // AbortError = User hat Share-Sheet abgebrochen → still bleiben.
        if (err instanceof Error && err.name === "AbortError") return;
        // sonstiger Fehler: in Clipboard-Fallback fallen
      }
    }

    // Fallback: Clipboard
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast("Link kopiert");
        return;
      }
    } catch {
      /* nächster Fallback */
    }

    // Letzter Fallback: legacy execCommand
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showToast("Link kopiert");
    } catch {
      showToast("Konnte nicht kopieren");
    }
  }, [restaurantName, slug, showToast]);

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label="Speisekarte teilen"
        className="grid h-10 w-10 place-items-center rounded-full backdrop-blur-md transition-colors active:scale-95"
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 6l-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {toast ? (
        <div
          className="fixed left-1/2 z-[1100] -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-semibold"
          style={{
            bottom: 88,
            backgroundColor: "rgba(20,18,15,0.96)",
            color: "#fff",
            boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
