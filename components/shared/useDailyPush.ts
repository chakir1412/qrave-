import { useCallback, useEffect, useState } from "react";
import type { DailyPush } from "./types";

/**
 * Daily-Push-Popup-Hook. Auto-Open wurde entfernt (nervte Gäste); Banner-Klicks
 * öffnen heute direkt das Item-Modal. Der Hook bleibt als manueller Schalter für
 * Sonderfälle (Preview, Templates) bestehen, hat aber keinen Timer mehr.
 */
export function useDailyPush(_dailyPush: DailyPush | null, _consentGiven: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const openPopup = useCallback(() => {
    setOpen(true);
  }, []);

  const closePopup = useCallback(() => {
    setOpen(false);
    document.body.style.overflow = "";
  }, []);

  return { open, openPopup, closePopup };
}

