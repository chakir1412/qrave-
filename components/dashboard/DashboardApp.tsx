"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyPush } from "@/lib/supabase";
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
import { OeffnungszeitenOverlay } from "./overlays/OeffnungszeitenOverlay";
import { AddCategoryOverlay } from "./overlays/AddCategoryOverlay";
import { TischeConfigPage } from "./pages/TischeConfigPage";
import { PreviewPage } from "./pages/PreviewPage";
import type {
  DashboardRestaurant,
  DashboardTab,
  KarteSub,
  OverlaysState,
  PagesState,
} from "./types";
import { dash } from "./constants";
import { extractDominantColor, todayIsoDate } from "./utils";

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
  restaurant: DashboardRestaurant;
  initialMenuItems: MenuItem[];
  initialAnalytics: DashboardAnalytics;
  initialDailyPush: DailyPush | null;
};

export function DashboardApp({
  userFirstName,
  restaurant: restaurantProp,
  initialMenuItems,
  initialAnalytics,
  initialDailyPush,
}: Props) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState(restaurantProp);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(initialAnalytics);
  const [dailyPush, setDailyPush] = useState<DailyPush | null>(initialDailyPush);

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
    oeffnung: false,
  });
  const [pages, setPages] = useState<PagesState>({
    tischeConfig: false,
    preview: false,
  });

  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editDefaultCategory, setEditDefaultCategory] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);

  const [guestNotiz, setGuestNotiz] = useState("");

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [dailyForm, setDailyForm] = useState<DailyForm>({
    mode: "select",
    itemId: null,
    name: "",
    desc: "",
    emoji: "⭐",
  });
  const [savingDaily, setSavingDaily] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [colorInput, setColorInput] = useState(
    restaurantProp.accent_color ?? "#111111",
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(
    restaurantProp.logo_url ?? null,
  );
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(
    restaurantProp.logo_url ?? null,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [extractedColor, setExtractedColor] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);

  const currentLogoFilename = (() => {
    const url = currentLogoUrl ?? "";
    if (!url) return null;
    const clean = url.split("?")[0] ?? url;
    const parts = clean.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? clean;
  })();

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
    setDailyPush(initialDailyPush);
  }, [initialDailyPush]);

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

  async function handleTemplateChange(templateId: string) {
    setSavingTemplate(true);
    await supabase.from("restaurants").update({ template: templateId }).eq("id", restaurant.id);
    setRestaurant({ ...restaurant, template: templateId });
    setSavingTemplate(false);
    showToast("✓ Template gespeichert");
  }

  async function handleDailyPushSave() {
    setSavingDaily(true);
    setDailyError(null);
    try {
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
        .upsert(
          {
            restaurant_id: restaurant.id,
            active_date: today,
            item_name: name,
            item_desc: desc || null,
            item_emoji: emoji,
          },
          { onConflict: "restaurant_id,active_date" },
        )
        .select("id, restaurant_id, active_date, item_emoji, item_name, item_desc")
        .single();

      if (error) {
        setDailyError(error.message);
        return;
      }
      setDailyPush(data as DailyPush);
      showToast("✓ Tagesempfehlung gespeichert");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Speichern.";
      setDailyError(msg);
    } finally {
      setSavingDaily(false);
    }
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setExtracting(true);
    try {
      const dominant = await extractDominantColor(file);
      if (dominant) {
        setExtractedColor(dominant);
        setColorInput(dominant);
      }
    } finally {
      setExtracting(false);
    }
  }

  function handleColorPickerChange(e: ChangeEvent<HTMLInputElement>) {
    setColorInput(e.target.value);
  }

  function handleHexInputChange(e: ChangeEvent<HTMLInputElement>) {
    let value = e.target.value;
    if (!value.startsWith("#")) value = `#${value}`;
    setColorInput(value);
  }

  async function handleSaveBranding() {
    setBrandingMessage(null);
    setSavingBranding(true);
    try {
      let logoUrl: string | null = restaurant.logo_url ?? null;

      if (logoFile) {
        const mime = (logoFile.type || "").toLowerCase();
        const forcedExt =
          mime === "image/png"
            ? "png"
            : mime === "image/jpeg"
              ? "jpg"
              : (logoFile.name.split(".").pop() ?? "png").toLowerCase();
        const path = `restaurants/${restaurant.slug}/logo.${forcedExt}`;
        const { error: uploadErr } = await supabase.storage
          .from("restaurant-assets")
          .upload(path, logoFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: logoFile.type || undefined,
          });
        if (uploadErr) {
          setBrandingMessage(`Logo-Upload fehlgeschlagen: ${uploadErr.message}`);
          return;
        }
        const { data: publicUrlData } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
        const publicUrl = publicUrlData.publicUrl ?? null;
        logoUrl = publicUrl ? `${publicUrl}?t=${Date.now()}` : null;
      }

      const { error: updateError } = await supabase
        .from("restaurants")
        .update({
          accent_color: colorInput,
          logo_url: logoUrl,
        })
        .eq("id", restaurant.id);

      if (updateError) {
        setBrandingMessage(`Speichern fehlgeschlagen: ${updateError.message}`);
        return;
      }

      if (logoUrl) {
        setCurrentLogoUrl(logoUrl);
        setLogoPreview(logoUrl);
      }
      setRestaurant({
        ...restaurant,
        accent_color: colorInput,
        logo_url: logoUrl ?? restaurant.logo_url,
      });
      setBrandingMessage("✓ Gespeichert");
      showToast("✓ Logo & Farbe gespeichert");
    } finally {
      setSavingBranding(false);
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
    <div className="min-h-dvh pb-28" style={{ backgroundColor: dash.bg, color: dash.tx }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
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
              dailyPush={dailyPush}
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
              dailyPush={dailyPush}
              onDailyPushUpdated={setDailyPush}
              dailyForm={dailyForm}
              setDailyForm={setDailyForm}
              savingDaily={savingDaily}
              dailyError={dailyError}
              onSaveDaily={handleDailyPushSave}
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
              onOpenConfig={() => setPages((p) => ({ ...p, tischeConfig: true }))}
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
        savingTemplate={savingTemplate}
        onTemplateChange={(id) => void handleTemplateChange(id)}
        onOpenOeffnung={() => setOverlays((o) => ({ ...o, oeffnung: true }))}
        onLogout={() => void handleLogout()}
        colorInput={colorInput}
        onColorPickerChange={handleColorPickerChange}
        onHexInputChange={handleHexInputChange}
        logoPreview={logoPreview}
        onLogoFileChange={(e) => void handleLogoChange(e)}
        extracting={extracting}
        savingBranding={savingBranding}
        onSaveBranding={() => void handleSaveBranding()}
        brandingMessage={brandingMessage}
        currentLogoUrl={currentLogoUrl}
        currentLogoFilename={currentLogoFilename}
        extractedColor={extractedColor}
      />

      <OeffnungszeitenOverlay
        open={overlays.oeffnung}
        onClose={() => setOverlays((o) => ({ ...o, oeffnung: false }))}
        restaurantId={restaurant.id}
        openingHoursFromDb={restaurant.opening_hours ?? null}
        onOpeningHoursSaved={(hours) =>
          setRestaurant((r) => ({ ...r, opening_hours: hours }))
        }
        onToast={showToast}
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

      <TischeConfigPage
        open={pages.tischeConfig}
        onClose={() => {
          setPages((p) => ({ ...p, tischeConfig: false }));
          void refreshTables();
        }}
        restaurantId={restaurant.id}
        slug={restaurant.slug}
        bereiche={tischBereiche}
        onToast={showToast}
        onTablesUpdated={() => void refreshTables()}
      />

      <PreviewPage
        open={pages.preview}
        onClose={() => setPages((p) => ({ ...p, preview: false }))}
        restaurantName={restaurant.name}
        slug={restaurant.slug}
        logoUrl={currentLogoUrl ?? restaurant.logo_url ?? null}
        menuItems={menuItems}
        dailyPush={dailyPush}
        guestNotiz={guestNotiz}
      />

      <DashboardToast message={toast} onHide={() => setToast(null)} />
    </div>
  );
}
