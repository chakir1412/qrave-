"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MenuItem } from "@/lib/supabase";
import {
  getOrCreateSessionId,
  getOrCreateVisitorId,
  priceBucketFromEur,
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
  // DSGVO/TTDSG §25: Visitor-ID wird LAZY innerhalb von safeTrack geholt,
  // nicht am Mount. So wird sie nur erstellt nachdem der Gast Consent
  // erteilt hat. `getOrCreateVisitorId` selbst prüft den Consent
  // zusätzlich (Defense-in-Depth).

  const categoryEnterTimeRef = useRef<Record<string, number>>({});
  const visibleCatsRef = useRef<Set<string>>(new Set());
  const observerMapRef = useRef<Map<string, IntersectionObserver>>(new Map());
  const scrollSentRef = useRef<Set<string>>(new Set());
  const mainTabInitedRef = useRef(false);
  const filterInitedRef = useRef(false);
  const leaveFlushRef = useRef(false);
  // Item-View-Tracking: pro Session 1× pro Item. ItemId → Observer.
  const itemViewedRef = useRef<Set<string>>(new Set());
  const itemViewTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const itemObserverMapRef = useRef<Map<string, IntersectionObserver>>(new Map());

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
      // Erst HIER (nach Consent-Check) die Visitor-ID aufbauen/lesen.
      const { returnVisit } = getOrCreateVisitorId();
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
    [restaurantId, tischNummer, sessionId],
  );

  useEffect(() => {
    return () => {
      observerMapRef.current.forEach((io) => io.disconnect());
      observerMapRef.current.clear();
      itemObserverMapRef.current.forEach((io) => io.disconnect());
      itemObserverMapRef.current.clear();
      itemViewTimerRef.current.forEach((t) => clearTimeout(t));
      itemViewTimerRef.current.clear();
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
    const priceBucket = priceBucketFromEur(itemPrice);
    void safeTrack({
      eventType: "item_detail",
      itemId: modalItem.id,
      itemName: modalItem.name,
      kategorie: modalItem.kategorie,
      mainTab: modalItem.main_tab ?? undefined,
      itemPrice,
      itemTags,
      beverageSubcategory,
      priceBucket,
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
      const itemPrice =
        typeof item.preis === "number" && Number.isFinite(item.preis) ? item.preis : null;
      const priceBucket = priceBucketFromEur(itemPrice);
      void safeTrack({
        eventType: "wishlist_add",
        itemId: item.id,
        itemName: item.name,
        kategorie: item.kategorie,
        mainTab: item.main_tab ?? undefined,
        itemPrice,
        priceBucket,
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

  /** Item-Card-Observer für View-Tracking.
   *  Item gilt als „gesehen" wenn ≥ 50% der Card im Viewport sind und das
   *  ≥ 500ms anhält. Wird pro Session nur einmal pro Item gefeuert; der
   *  Observer wird nach dem ersten erfolgreichen View disconnected. */
  const onItemCardRef = useCallback(
    (item: MenuItem, element: HTMLElement | null) => {
      if (!restaurantId) return;
      const id = item.id;

      // Wenn das Element abgehängt wird: alten Observer + Timer aufräumen.
      const existing = itemObserverMapRef.current.get(id);
      existing?.disconnect();
      itemObserverMapRef.current.delete(id);
      const pendingTimer = itemViewTimerRef.current.get(id);
      if (pendingTimer !== undefined) {
        clearTimeout(pendingTimer);
        itemViewTimerRef.current.delete(id);
      }

      if (!element) return;
      if (itemViewedRef.current.has(id)) return; // schon getrackt → kein neuer Observer

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.target !== element) continue;
            if (itemViewedRef.current.has(id)) {
              io.disconnect();
              itemObserverMapRef.current.delete(id);
              return;
            }
            if (e.isIntersecting && e.intersectionRatio >= 0.5) {
              if (itemViewTimerRef.current.has(id)) continue; // Timer läuft bereits
              const t = setTimeout(() => {
                itemViewTimerRef.current.delete(id);
                if (itemViewedRef.current.has(id)) return;
                itemViewedRef.current.add(id);
                io.disconnect();
                itemObserverMapRef.current.delete(id);
                void safeTrack({
                  eventType: "item_view",
                  itemId: item.id,
                  itemName: item.name,
                  kategorie: item.kategorie,
                  mainTab: item.main_tab ?? undefined,
                });
              }, 500);
              itemViewTimerRef.current.set(id, t);
            } else {
              // Item verlässt den Viewport bevor 500ms voll sind → Timer abbrechen.
              const cur = itemViewTimerRef.current.get(id);
              if (cur !== undefined) {
                clearTimeout(cur);
                itemViewTimerRef.current.delete(id);
              }
            }
          }
        },
        { threshold: [0, 0.5, 1] },
      );
      io.observe(element);
      itemObserverMapRef.current.set(id, io);
    },
    [restaurantId, safeTrack],
  );

  return {
    onCategorySectionRef,
    onItemCardRef,
    trackWishlistAdd,
    trackWishlistRemove,
    trackCategoryTabSelect,
  };
}
