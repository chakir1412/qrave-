import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyPush } from "./types";

const DELAY_MS = 6000;

export function useDailyPush(dailyPush: DailyPush | null, consentGiven: boolean) {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  const timerStartedRef = useRef(false);

  // Popup erst nach 6 Sekunden anzeigen (nicht sofort). Zeitprüfung verhindert versehentliches sofortiges Öffnen.
  const dailyPushId = dailyPush?.id ?? null;
  useEffect(() => {
    if (!consentGiven || !dailyPushId || timerStartedRef.current) return;
    timerStartedRef.current = true;
    const start = Date.now();
    const t = setTimeout(() => {
      if (Date.now() - start < DELAY_MS - 200) return;
      shownRef.current = true;
      setOpen(true);
    }, DELAY_MS);
    return () => {
      clearTimeout(t);
      timerStartedRef.current = false;
    };
  }, [dailyPushId, consentGiven]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const openPopup = useCallback(() => {
    if (!dailyPush) return;
    setOpen(true);
  }, [dailyPush]);

  const closePopup = useCallback(() => {
    setOpen(false);
    document.body.style.overflow = "";
  }, []);

  return { open, openPopup, closePopup };
}

