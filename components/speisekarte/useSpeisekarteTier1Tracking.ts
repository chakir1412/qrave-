"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MenuItem } from "@/lib/supabase";
import {
  getOrCreateSessionId,
  getOrCreateVisitorId,
  trackEvent,
  type TrackEventParams,
} from "@/lib/tracking";
import { filterTrackingItemTags, mapBeverageSubcategory } from "@/lib/beverage-classification";
import type { FilterKey } from "./constants";

type UseSpeisekarteTier1TrackingArgs = {
  restaurantId?: string;
  tischNummer?: number;
  effectiveMainTab: string;
  filter: FilterKey;
  modalItem: MenuItem | null;
};

export function useSpeisekarteTier1Tracking({
  restaurantId,
  tischNummer,
  effectiveMainTab,
  filter,
  modalItem,
}: UseSpeisekarteTier1TrackingArgs) {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  // Persistente Browser-ID (localStorage). returnVisit = true wenn der
  // Browser schon mal hier war — wird an jedem Tier-1-Event mitgeschickt.
  const { returnVisit } = useMemo(() => getOrCreateVisitorId(), []);

  const categoryEnterTimeRef = useRef<Record<string, number>>({});
  const visibleCatsRef = useRef<Set<string>>(new Set());
  const observerMapRef = useRef<Map<string, IntersectionObserver>>(new Map());
  const scrollSentRef = useRef<Set<string>>(new Set());
  const mainTabInitedRef = useRef(false);
  const filterInitedRef = useRef(false);
  const leaveFlushRef = useRef(false);

  const safeTrack = useCallback(
    async (partial: Omit<TrackEventParams, "restaurantId" | "sessionId">) => {
      if (!restaurantId || !sessionId) return;
      // DSGVO: Tier-1 Events nur senden, wenn der Gast aktiv eingewilligt hat.
      // `declined` und „noch nicht entschieden" werden gleich behandelt — kein
      // Tracking bis explizites accepted.
      if (typeof window !== "undefined") {
        try {
          if (window.localStorage.getItem("qrave_consent") !== "accepted") {
            return;
          }
        } catch {
          // localStorage nicht verfügbar (z. B. Privacy-Modus) → nicht tracken.
          return;
        }
      } else {
        return;
      }
      try {
        await trackEvent({
          restaurantId,
          tischNummer,
          sessionId,
          returnVisit,
          ...partial,
        });
      } catch {
        /* nie crashen */
      }
    },
    [restaurantId, tischNummer, sessionId, returnVisit],
  );

  useEffect(() => {
    return () => {
      observerMapRef.current.forEach((io) => io.disconnect());
      observerMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!modalItem) return;
    const start = Date.now();
    const itemPrice =
      typeof modalItem.preis === "number" && Number.isFinite(modalItem.preis)
        ? modalItem.preis
        : null;
    const itemTags = filterTrackingItemTags(modalItem.tags);
    const beverageSubcategory = mapBeverageSubcategory(modalItem.kategorie, modalItem.main_tab);
    void safeTrack({
      eventType: "item_detail",
      itemId: modalItem.id,
      itemName: modalItem.name,
      kategorie: modalItem.kategorie,
      mainTab: modalItem.main_tab ?? undefined,
      itemPrice,
      itemTags,
      beverageSubcategory,
    });
    return () => {
      const d = Math.round((Date.now() - start) / 1000);
      if (d > 1) {
        void safeTrack({
          eventType: "item_detail_duration",
          itemId: modalItem.id,
          itemName: modalItem.name,
          kategorie: modalItem.kategorie,
          mainTab: modalItem.main_tab ?? undefined,
          durationSeconds: d,
        });
      }
    };
  }, [modalItem, safeTrack]);

  useEffect(() => {
    if (!restaurantId) return;
    if (!mainTabInitedRef.current) {
      mainTabInitedRef.current = true;
      return;
    }
    void safeTrack({ eventType: "tab_switch", mainTab: effectiveMainTab });
  }, [effectiveMainTab, restaurantId, safeTrack]);

  useEffect(() => {
    if (!restaurantId) return;
    if (!filterInitedRef.current) {
      filterInitedRef.current = true;
      return;
    }
    void safeTrack({
      eventType: "filter_set",
      filterKey: filter,
      mainTab: effectiveMainTab,
    });
  }, [filter, effectiveMainTab, restaurantId, safeTrack]);

  useEffect(() => {
    scrollSentRef.current.clear();
  }, [effectiveMainTab]);

  useEffect(() => {
    if (!restaurantId) return;
    const milestones = [25, 50, 75, 100] as const;
    const onScroll = () => {
      const doc = document.documentElement;
      const h = doc.scrollHeight - doc.clientHeight;
      if (h <= 0) return;
      const pct = Math.round((doc.scrollTop / h) * 100);
      for (const m of milestones) {
        if (pct >= m) {
          const key = `${effectiveMainTab}-${m}`;
          if (!scrollSentRef.current.has(key)) {
            scrollSentRef.current.add(key);
            void safeTrack({
              eventType: "scroll_depth",
              scrollPct: m,
              mainTab: effectiveMainTab,
            });
          }
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [restaurantId, effectiveMainTab, safeTrack]);

  useEffect(() => {
    if (!restaurantId) return;
    leaveFlushRef.current = false;

    // Wir messen NUR aktive Sichtbarkeitszeit. Wenn der Tab in den Hintergrund
    // wechselt (visibilityState === "hidden"), wird der bisher aktive Block
    // aufaddiert; bei "visible" startet ein neuer Block. So zählen Phasen,
    // in denen der Gast eine andere App offen hat, nicht zur Session-Dauer.
    let activeMs = 0;
    let visibleSince: number | null =
      typeof document !== "undefined" && document.visibilityState === "visible"
        ? Date.now()
        : null;

    const accumulateActive = () => {
      if (visibleSince != null) {
        activeMs += Date.now() - visibleSince;
        visibleSince = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (visibleSince == null) visibleSince = Date.now();
      } else {
        accumulateActive();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const flushLeave = () => {
      if (leaveFlushRef.current) return;
      leaveFlushRef.current = true;
      accumulateActive();
      const duration = Math.max(0, Math.round(activeMs / 1000));
      void safeTrack({
        eventType: "session_end",
        sessionDuration: duration,
      });
      if (duration < 5) {
        void safeTrack({
          eventType: "bounce",
          bounce: true,
        });
      }
    };

    window.addEventListener("pagehide", flushLeave);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushLeave);
      flushLeave();
    };
  }, [restaurantId, safeTrack]);

  const onCategorySectionRef = useCallback(
    (kategorie: string, element: HTMLElement | null) => {
      if (!restaurantId) return;
      const existing = observerMapRef.current.get(kategorie);
      existing?.disconnect();
      observerMapRef.current.delete(kategorie);

      if (!element) {
        if (visibleCatsRef.current.has(kategorie)) {
          visibleCatsRef.current.delete(kategorie);
          const t0 = categoryEnterTimeRef.current[kategorie] ?? Date.now();
          delete categoryEnterTimeRef.current[kategorie];
          const durationSeconds = Math.round((Date.now() - t0) / 1000);
          void safeTrack({
            eventType: "category_leave",
            kategorie,
            durationSeconds,
          });
        }
        return;
      }

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.target !== element) continue;
            const vis = visibleCatsRef.current.has(kategorie);
            if (e.isIntersecting && e.intersectionRatio >= 0.15) {
              if (!vis) {
                visibleCatsRef.current.add(kategorie);
                categoryEnterTimeRef.current[kategorie] = Date.now();
                void safeTrack({
                  eventType: "category_enter",
                  kategorie,
                });
              }
            } else if (vis) {
              visibleCatsRef.current.delete(kategorie);
              const t0 = categoryEnterTimeRef.current[kategorie] ?? Date.now();
              delete categoryEnterTimeRef.current[kategorie];
              const durationSeconds = Math.round((Date.now() - t0) / 1000);
              void safeTrack({
                eventType: "category_leave",
                kategorie,
                durationSeconds,
              });
            }
          }
        },
        { threshold: [0, 0.15, 0.25, 0.5, 1] },
      );
      io.observe(element);
      observerMapRef.current.set(kategorie, io);
    },
    [restaurantId, safeTrack],
  );

  const trackWishlistAdd = useCallback(
    (item: MenuItem) => {
      void safeTrack({
        eventType: "wishlist_add",
        itemId: item.id,
        itemName: item.name,
        kategorie: item.kategorie,
        mainTab: item.main_tab ?? undefined,
      });
    },
    [safeTrack],
  );

  const trackWishlistRemove = useCallback(
    (itemId: string) => {
      void safeTrack({
        eventType: "wishlist_remove",
        itemId,
      });
    },
    [safeTrack],
  );

  /** Expliziter Klick auf einen Kategorie-Tab (nicht nur Scroll-Sichtbarkeit). */
  const trackCategoryTabSelect = useCallback(
    (kategorie: string) => {
      void safeTrack({
        eventType: "category_enter",
        kategorie,
        mainTab: kategorie,
      });
    },
    [safeTrack],
  );

  return {
    onCategorySectionRef,
    trackWishlistAdd,
    trackWishlistRemove,
    trackCategoryTabSelect,
  };
}
