"use client";

import { useEffect, useState } from "react";

/** `true`, sobald `window.matchMedia(query)` matched (nach Mount). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export const FOUNDER_DESKTOP_MEDIA = "(min-width: 768px)";
