import type { RestaurantAnalyticsComputed } from "@/lib/restaurant-analytics-aggregate";

export type RestaurantAnalyticsApiRestaurant = {
  id: string;
  name: string;
  slug: string;
  stadt: string | null;
  telefon: string | null;
  aktiv: boolean;
  /** Stammdaten für Targeting (Werte siehe Migration 20260508140000). */
  cuisine_type: string | null;
  stadtbezirk: string | null;
  sitzplaetze_ca: number | null;
  restaurant_typ: string | null;
};

export type RestaurantAnalyticsApiPayload = {
  fromYmd: string;
  toYmd: string;
  restaurant: RestaurantAnalyticsApiRestaurant | null;
  founderExtra: {
    next_visit: string | null;
    last_visit: string | null;
    note: string | null;
    sticker_tier: string | null;
    sticker_paid: boolean;
    sticker_count: number;
  } | null;
  computed: RestaurantAnalyticsComputed;
  eventRowCount: number;
};

export type { RestaurantAnalyticsComputed };
