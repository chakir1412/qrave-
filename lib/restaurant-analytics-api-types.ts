import type { FounderRestaurantTableRow } from "@/lib/founder-types";
import type { RestaurantAnalyticsComputed } from "@/lib/restaurant-analytics-aggregate";

export type RestaurantAnalyticsApiRestaurant = {
  id: string;
  name: string;
  slug: string;
  stadt: string | null;
  telefon: string | null;
  aktiv: boolean;
};

export type RestaurantAnalyticsApiPayload = {
  fromYmd: string;
  toYmd: string;
  restaurant: RestaurantAnalyticsApiRestaurant | null;
  tables: FounderRestaurantTableRow[];
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
