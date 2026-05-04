"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyPush, LunchOffer, OpeningHours } from "@/lib/supabase";
import type { MenuItem } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { sortOrderIndexForKategorie } from "@/lib/category-sort-order";
import { useRestaurantTables } from "@/hooks/useTische";
import { fetchDashboardAnalytics, type DashboardAnalytics } from "@/hooks/useAnalytics";
import { DashboardBottomNav } from "./BottomNav";
import { DashboardHeader } from "./Header";
import { DashboardToast } from "./DashboardToast";
import { HomeTab } from "./tabs/HomeTab";
import { KarteTab } from "./tabs/KarteTab";
import { TischeTab } from "./tabs/TischeTab";
import { SettingsOverlay } from "./overlays/SettingsOverlay";
import { EditItemOverlay } from "./overlays/EditItemOverlay";
import { AddCategoryOverlay } from "./overlays/AddCategoryOverlay";
import { PreviewPage } from "./pages/PreviewPage";
import type {
  DashboardRestaurant,
  DashboardTab,
  KarteSub,
  OverlaysState,
  PagesState,
} from "./types";
import { dash } from "./constants";
import { todayIsoDate } from "./utils";

const TAB_ORDER: Record<DashboardTab, number> = {
  karte: 0,
  home: 1,
  tische: 2,
};

type DailyForm = {
  mode: "select" | "manual";
  itemId: string | null;
  name: string;
  desc: string;
  emoji: string;
};

type Props = {
  userFirstName: string;
  userEmail: string;
  restaurant: DashboardRestaurant;
  initialMenuItems: MenuItem[];
  initialAnalytics: DashboardAnalytics;
  initialDailyPushes: DailyPush[];
  initialLunchOffers: LunchOffer[];
};

const MAX_DAILY_PUSHES = 3;

export function DashboardApp({
  userFirstName,
  userEmail,
  restaurant: restaurantProp,
  initialMenuItems,
  initialAnalytics,
  initialDailyPushes,
  initialLunchOffers,
}: Props) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState(restaurantProp);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(initialAnalytics);
  const [dailyPushes, setDailyPushes] = useState<DailyPush[]>(initialDailyPushes);
  const [lunchOffers, setLunchOffers] = useState<LunchOffer[]>(initialLunchOffers);

  const {
    bereiche: tischBereiche,
    loading: tischeLoading,
    error: tischeError,
    refresh: refreshTables,
  } = useRestaurantTables(restaurant.id);

  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const prevTabRef = useRef<DashboardTab>("home");
  const [slideClass, setSlideClass] = useState("dashboard-slR");

  const [activeKarteSub, setActiveKarteSub] = useState<KarteSub>("menu");

  const [overlays, setOverlays] = useState<OverlaysState>({
    settings: false,
    editItem: false,
    addCat: false,
  });
  const [pages, setPages] = useState<PagesState>({
    preview: false,
  });

  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editDefaultCategory, setEditDefaultCategory] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);

  const [guestNotiz, setGuestNotiz] = useState("");

  const [dailyForm, setDailyForm] = useState<DailyForm>({
    mode: "select",
    itemId: null,
    name: "",
    desc: "",
    emoji: "⭐",
  });
  const [savingDaily, setSavingDaily] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(
    restaurantProp.logo_url ?? null,
  );
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(
    restaurantProp.logo_url ?? null,
  );
  const [extracting, setExtracting] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);

  useEffect(() => {
    setRestaurant(restaurantProp);
  }, [restaurantProp]);

  useEffect(() => {
    setMenuItems(initialMenuItems);
  }, [initialMenuItems]);

  useEffect(() => {
    setAnalytics(initialAnalytics);
  }, [initialAnalytics]);

  useEffect(() => {
    setDailyPushes(initialDailyPushes);
  }, [initialDailyPushes]);

  useEffect(() => {
    setLunchOffers(initialLunchOffers);
  }, [initialLunchOffers]);

  useEffect(() => {
    setGuestNotiz(restaurant.guest_note ?? "");
  }, [restaurant.id, restaurant.guest_note]);

  const goTab = useCallback((t: DashboardTab) => {
    const prev = prevTabRef.current;
    setSlideClass(TAB_ORDER[t] > TAB_ORDER[prev] ? "dashboard-slR" : "dashboard-slL");
    prevTabRef.current = t;
    setActiveTab(t);
  }, []);

  const reloadAnalytics = useCallback(async () => {
    const next = await fetchDashboardAnalytics(restaurant.id);
    setAnalytics(next);
  }, [restaurant.id]);

  async function handleSaveGuestNote() {
    const value = guestNotiz;
    const { error } = await supabase
      .from("restaurants")
      .update({ guest_note: value })
      .eq("id", restaurant.id);
    if (error) {
      showToast(error.message ?? "Notiz konnte nicht gespeichert werden");
      return;
    }
    setRestaurant((r) => ({ ...r, guest_note: value }));
    showToast("✓ Notiz gespeichert");
  }

  const handlePatchRestaurant = useCallback(
    async (patch: {
      adresse?: string | null;
      telefon?: string | null;
      opening_hours?: OpeningHours;
    }) => {
      const { error } = await supabase
        .from("restaurants")
        .update(patch)
        .eq("id", restaurant.id);
      if (error) {
        showToast(error.message ?? "Speichern fehlgeschlagen");
        return;
      }
      setRestaurant((r) => ({ ...r, ...patch }));
      showToast("✓ Gespeichert");
    },
    [restaurant.id, showToast],
  );

  async function handleDailyPushSave() {
    setSavingDaily(true);
    setDailyError(null);
    try {
      if (dailyPushes.length >= MAX_DAILY_PUSHES) {
        setDailyError(`Maximal ${MAX_DAILY_PUSHES} Tages-Specials gleichzeitig.`);
        return;
      }
      let name = dailyForm.name.trim();
      let desc = dailyForm.desc.trim();
      const emoji = dailyForm.emoji.trim() || "⭐";

      if (dailyForm.mode === "select" && dailyForm.itemId) {
        const m = menuItems.find((x) => x.id === dailyForm.itemId);
        if (m) {
          name = m.name;
          desc = m.beschreibung ?? "";
        }
      }

      if (!name) {
        setDailyError("Bitte Name wählen oder eingeben.");
        return;
      }

      const today = todayIsoDate();
      const { data, error } = await supabase
        .from("daily_push")
        .insert({
          restaurant_id: restaurant.id,
          active_date: today,
          item_name: name,
          item_desc: desc || null,
          item_emoji: emoji,
        })
        .select("id, restaurant_id, active_date, item_emoji, item_name, item_desc, created_at")
        .single();

      if (error) {
        setDailyError(error.message);
        return;
      }
      setDailyPushes((prev) => [...prev, data as DailyPush]);
      setDailyForm({ mode: "select", itemId: null, name: "", desc: "", emoji: "⭐" });
      showToast("✓ Tages-Special hinzugefügt");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Speichern.";
      setDailyError(msg);
    } finally {
      setSavingDaily(false);
    }
  }

  async function handleDailyPushDelete(id: string) {
    const { error } = await supabase.from("daily_push").delete().eq("id", id);
    if (error) {
      showToast(error.message ?? "Konnte nicht entfernt werden");
      return;
    }
    setDailyPushes((prev) => prev.filter((p) => p.id !== id));
    showToast("✓ Special entfernt");
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImmediateLogoUpload(file);
    e.target.value = "";
  }

  async function handleImmediateLogoUpload(file: File) {
    setLogoPreview(URL.createObjectURL(file));
    setExtracting(true);
    setBrandingMessage(null);
    try {
      const mime = (file.type || "").toLowerCase();
      const forcedExt =
        mime === "image/png"
          ? "png"
          : mime === "image/jpeg"
            ? "jpg"
            : (file.name.split(".").pop() ?? "png").toLowerCase();
      const path = `${restaurant.id}/logo.${forcedExt}`;
      const { error: uploadErr } = await supabase.storage.from("restaurant-assets").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });
      if (uploadErr) {
        setBrandingMessage(`Logo-Upload fehlgeschlagen: ${uploadErr.message}`);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl ?? null;
      const logoUrl = publicUrl ? `${publicUrl}?t=${Date.now()}` : null;
      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ logo_url: logoUrl })
        .eq("id", restaurant.id);
      if (updateError) {
        setBrandingMessage(`Speichern fehlgeschlagen: ${updateError.message}`);
        return;
      }
      if (logoUrl) {
        setCurrentLogoUrl(logoUrl);
        setLogoPreview(logoUrl);
      }
      setRestaurant((r) => ({ ...r, logo_url: logoUrl ?? r.logo_url }));
      showToast("✓ Logo gespeichert");
    } finally {
      setExtracting(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login?redirect=/dashboard");
  }

  async function handleAddCategory(name: string) {
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: restaurant.id,
        name: "Neuer Eintrag",
        beschreibung: null,
        preis: 0,
        kategorie: name,
        aktiv: false,
        sort_order: sortOrderIndexForKategorie(name),
      })
      .select(
        "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order",
      )
      .single();
    if (error || !data) {
      const msg = error?.message ?? "Kategorie konnte nicht angelegt werden";
      showToast(msg);
      throw new Error(msg);
    }
    setMenuItems((prev) => [...prev, data as MenuItem]);
    showToast("✓ Kategorie angelegt");
  }

  return (
    <div className="relative min-h-dvh pb-28 font-sans" style={{ backgroundColor: dash.bg, color: dash.tx }}>
      <div className="dashboard-bg-blobs" aria-hidden>
        <div className="dashboard-blob dashboard-blob--1" />
        <div className="dashboard-blob dashboard-blob--2" />
        <div className="dashboard-blob dashboard-blob--3" />
      </div>
      <div className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 md:max-w-[860px] md:px-6 md:py-10">
        <DashboardHeader onOpenSettings={() => setOverlays((o) => ({ ...o, settings: true }))} />

        <main className="flex-1">
          {activeTab === "home" && (
            <HomeTab
              key={`home-${slideClass}`}
              slideClass={slideClass}
              userFirstName={userFirstName}
              restaurantName={restaurant.name}
              viewsToday={analytics.viewsToday}
              viewsYesterday={analytics.viewsYesterday}
              weekSeries={analytics.weekSeries}
              topItemsWeek={analytics.topItemsWeek}
              menuItems={menuItems}
              peaksToday={analytics.peaksToday}
              dailyPushes={dailyPushes}
              onGoKarte={(sub) => {
                setActiveKarteSub(sub);
                goTab("karte");
              }}
            />
          )}
          {activeTab === "karte" && (
            <KarteTab
              key={`karte-${slideClass}`}
              slideClass={slideClass}
              restaurantId={restaurant.id}
              slug={restaurant.slug}
              menuItems={menuItems}
              onItemsChange={setMenuItems}
              activeSub={activeKarteSub}
              onSubChange={setActiveKarteSub}
              onOpenEdit={(item) => {
                setEditItem(item);
                setEditDefaultCategory(item.kategorie ?? null);
                setOverlays((o) => ({ ...o, editItem: true }));
              }}
              onOpenCreateItem={(category) => {
                setEditItem(null);
                setEditDefaultCategory(category);
                setOverlays((o) => ({ ...o, editItem: true }));
              }}
              onOpenAddCat={() => setOverlays((o) => ({ ...o, addCat: true }))}
              onOpenPreview={() => setPages((p) => ({ ...p, preview: true }))}
              dailyPushes={dailyPushes}
              onDailyPushDelete={handleDailyPushDelete}
              maxDailyPushes={MAX_DAILY_PUSHES}
              dailyForm={dailyForm}
              setDailyForm={setDailyForm}
              savingDaily={savingDaily}
              dailyError={dailyError}
              onSaveDaily={handleDailyPushSave}
              lunchOffers={lunchOffers}
              onLunchOffersChange={setLunchOffers}
              onToast={showToast}
              guestNotiz={guestNotiz}
              onGuestNotizChange={setGuestNotiz}
              onSaveGuestNote={() => void handleSaveGuestNote()}
            />
          )}
          {activeTab === "tische" && (
            <TischeTab
              key={`tische-${slideClass}`}
              slideClass={slideClass}
              bereiche={tischBereiche}
              loading={tischeLoading}
              loadError={tischeError}
              onToast={showToast}
            />
          )}
        </main>

        <DashboardBottomNav active={activeTab} onChange={goTab} />
      </div>

      <SettingsOverlay
        open={overlays.settings}
        onClose={() => setOverlays((o) => ({ ...o, settings: false }))}
        restaurant={restaurant}
        userEmail={userEmail}
        onLogout={() => void handleLogout()}
        logoPreview={logoPreview}
        onLogoFileChange={(e) => void handleLogoChange(e)}
        extracting={extracting}
        brandingMessage={brandingMessage}
        currentLogoUrl={currentLogoUrl}
        onPatchRestaurant={handlePatchRestaurant}
      />

      <EditItemOverlay
        item={editItem}
        restaurantId={restaurant.id}
        defaultCategory={editDefaultCategory}
        open={overlays.editItem}
        onClose={() => {
          setOverlays((o) => ({ ...o, editItem: false }));
          setEditItem(null);
          setEditDefaultCategory(null);
        }}
        onSaved={(updated) => {
          setMenuItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          void reloadAnalytics();
        }}
        onCreated={(created) => {
          setMenuItems((prev) => [...prev, created]);
          void reloadAnalytics();
        }}
        onDeleted={(id) => {
          setMenuItems((prev) => prev.filter((x) => x.id !== id));
          void reloadAnalytics();
        }}
        onToast={showToast}
      />

      <AddCategoryOverlay
        open={overlays.addCat}
        onClose={() => setOverlays((o) => ({ ...o, addCat: false }))}
        onAdd={handleAddCategory}
      />

      <PreviewPage
        open={pages.preview}
        onClose={() => setPages((p) => ({ ...p, preview: false }))}
        restaurantName={restaurant.name}
        slug={restaurant.slug}
        logoUrl={currentLogoUrl ?? restaurant.logo_url ?? null}
        menuItems={menuItems}
        dailyPushes={dailyPushes}
        guestNotiz={guestNotiz}
      />

      <DashboardToast message={toast} onHide={() => setToast(null)} />
    </div>
  );
}
