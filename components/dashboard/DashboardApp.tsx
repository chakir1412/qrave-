"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyPush, LunchOffer } from "@/lib/supabase";
import type { MenuItem } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { sortOrderIndexForKategorie } from "@/lib/category-sort-order";
import { fetchDashboardAnalytics, type DashboardAnalytics } from "@/hooks/useAnalytics";
import { DashboardShell, type QuickActionKey } from "./DashboardShell";
import { DashboardToast } from "./DashboardToast";
import { HomeTab } from "./tabs/HomeTab";
import { KarteTab } from "./tabs/KarteTab";
import { TischeTab } from "./tabs/TischeTab";
import { DesignTab } from "./tabs/DesignTab";
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
import { todayIsoDate } from "./utils";

const TAB_ORDER: Record<DashboardTab, number> = {
  karte: 0,
  home: 1,
  design: 2,
  tische: 3,
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
  initialDailyPushes: DailyPush[];
  initialLunchOffers: LunchOffer[];
};

const MAX_DAILY_PUSHES = 3;

export function DashboardApp({
  userFirstName,
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

  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const prevTabRef = useRef<DashboardTab>("home");
  const [slideClass, setSlideClass] = useState("dashboard-slR");

  const [activeKarteSub, setActiveKarteSub] = useState<KarteSub>("menu");
  /** Wenn HomeTab → "Ausverkauft markieren" geklickt wird, springt KarteTab
   *  mit aktivem Filter rein. KarteTab consumed den Wert beim Mount und
   *  ruft `clearInitialFilter` auf — so wirkt der Filter nur einmal. */
  const [karteInitialFilter, setKarteInitialFilter] = useState<"soldout" | null>(null);

  const [overlays, setOverlays] = useState<OverlaysState>({
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

  const [currentLogoUrl] = useState<string | null>(restaurantProp.logo_url ?? null);

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

  // Quick-Actions aus der Sidebar — Tab-Switch + ggf. Sub-Tab/Filter setzen.
  const handleQuickAction = useCallback(
    (action: QuickActionKey) => {
      switch (action) {
        case "daily":
          setActiveKarteSub("heute");
          setActiveTab("karte");
          break;
        case "notiz":
          setActiveKarteSub("notiz");
          setActiveTab("karte");
          break;
        case "soldout":
          setActiveKarteSub("menu");
          setKarteInitialFilter("soldout");
          setActiveTab("karte");
          break;
        case "translate":
          router.push("/dashboard/ki-features#uebersetzen");
          break;
      }
    },
    [router],
  );

  // Beim Mount: ggf. von einer Sub-Page weitergereichte Tab/Sub/Filter konsumieren.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const tab = sessionStorage.getItem("qrave-dashboard-tab");
      if (tab === "home" || tab === "karte" || tab === "design" || tab === "tische") setActiveTab(tab);
      sessionStorage.removeItem("qrave-dashboard-tab");

      const sub = sessionStorage.getItem("qrave-karte-sub");
      if (sub === "menu" || sub === "heute" || sub === "lunch" || sub === "notiz") {
        setActiveKarteSub(sub);
      }
      sessionStorage.removeItem("qrave-karte-sub");

      const filter = sessionStorage.getItem("qrave-karte-filter");
      if (filter === "soldout") setKarteInitialFilter("soldout");
      sessionStorage.removeItem("qrave-karte-filter");
    } catch {
      // sessionStorage blockiert — Defaults bleiben.
    }
  }, []);

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

  const topbarTitle =
    activeTab === "karte" ? "Speisekarte" : activeTab === "design" ? "Design" : activeTab === "tische" ? "Tische" : "Dashboard";
  const avatarLabel = (userFirstName.trim().charAt(0) || restaurant.name.charAt(0) || "Q").toUpperCase();

  return (
    <DashboardShell
      activeTab={activeTab}
      onTabChange={(next) => goTab(next as DashboardTab)}
      title={topbarTitle}
      liveBadge={restaurant.published !== false && restaurant.aktiv !== false}
      avatarLabel={avatarLabel}
      previewUrl={`https://qrave.menu/${restaurant.slug}`}
      onQuickAction={handleQuickAction}
    >
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-6 md:px-8 md:pt-8">
        {restaurant.published === false ? (
          <div
            className="mb-4 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(201,168,76,0.4)",
              background: "rgba(201,168,76,0.1)",
              color: "#e7c977",
            }}
            role="status"
          >
            <span className="font-semibold">Deine Karte wird in Kürze freigeschaltet.</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.65)" }}>
              Wir prüfen die Registrierung und schalten dich frei. Du bekommst eine Mail sobald es soweit ist.
            </span>
          </div>
        ) : null}

        <main className="flex-1">
          {activeTab === "home" && (
            <HomeTab
              key="home-tab"
              userFirstName={userFirstName}
              restaurantName={restaurant.name}
              restaurantId={restaurant.id}
              events={analytics.events}
              menuItems={menuItems}
              onGoKarte={(sub, options) => {
                setActiveKarteSub(sub);
                if (options?.filter === "soldout") setKarteInitialFilter("soldout");
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
              initialFilter={karteInitialFilter}
              clearInitialFilter={() => setKarteInitialFilter(null)}
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
          {activeTab === "design" && (
            <DesignTab
              key="design-tab"
              slideClass={slideClass}
              template={restaurant.template ?? null}
              accentColor={restaurant.accent_color ?? null}
              backgroundMode={(restaurant as { background_mode?: string | null }).background_mode ?? null}
              customBgColor={(restaurant as { custom_bg_color?: string | null }).custom_bg_color ?? null}
              menuItems={menuItems}
              onTemplateChange={async ({ template: tpl, accentColor: ac, backgroundMode: bm, customBgColor: cbg, customTextColor: ctx }) => {
                const { data, error } = await supabase
                  .from("restaurants")
                  .update({
                    template: tpl,
                    accent_color: ac,
                    background_mode: bm,
                    custom_bg_color: cbg,
                    custom_text_color: ctx,
                  })
                  .eq("id", restaurant.id)
                  .select("id");
                if (error) throw new Error(error.message ?? "Speichern fehlgeschlagen");
                if (!data || data.length === 0) throw new Error("Keine Berechtigung zum Speichern");
                setRestaurant((r) => ({
                  ...r,
                  template: tpl,
                  accent_color: ac,
                  background_mode: bm,
                  custom_bg_color: cbg,
                  custom_text_color: ctx,
                }));
              }}
              onTabChange={(t) => goTab(t)}
              onToast={showToast}
            />
          )}
          {activeTab === "tische" && (
            <TischeTab
              key="tische-tab"
              initial={restaurant.tisch_bereiche ?? []}
              onSave={async (next) => {
                const { data, error } = await supabase
                  .from("restaurants")
                  .update({ tisch_bereiche: next })
                  .eq("id", restaurant.id)
                  .select("id");
                if (error) {
                  showToast(error.message ?? "Speichern fehlgeschlagen");
                  return;
                }
                if (!data || data.length === 0) {
                  showToast("Speichern fehlgeschlagen — keine Berechtigung");
                  return;
                }
                setRestaurant((r) => ({ ...r, tisch_bereiche: next }));
              }}
            />
          )}
        </main>
      </div>

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
    </DashboardShell>
  );
}
