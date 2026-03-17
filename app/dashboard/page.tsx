 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@/lib/supabase";

type TabKey = "home" | "design" | "today" | "stats";

type AnalyticsItem = {
  item_id: string | null;
  item_name: string | null;
  event_type: string | null;
  filter_key: string | null;
  created_at: string;
};

type DailyPushForm = {
  mode: "select" | "manual";
  itemId: string | null;
  name: string;
  desc: string;
  emoji: string;
};

const TEMPLATE_CARDS = [
  { id: "bar-soleil", label: "Bar Soleil", icon: "🖤" },
  { id: "kiosk-no7", label: "KIOSK No.7", icon: "🟡" },
  { id: "compound-cafe", label: "COMPOUND Café", icon: "🟤" },
  { id: "nami-sushi", label: "NAMI Sushi", icon: "🪵" },
  { id: "da-mario", label: "DA MARIO", icon: "🍕" },
  { id: "roots", label: "ROOTS", icon: "🌿" },
];

const ACCENT_COLORS = [
  { id: "#C8894E", label: "Kupfer", value: "#C8894E" },
  { id: "#FFD600", label: "Gold", value: "#FFD600" },
  { id: "#FFFFFF", label: "Weiß", value: "#FFFFFF" },
  { id: "#4a6d3e", label: "Grün", value: "#4a6d3e" },
];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [accentColor, setAccentColor] = useState<string | null>(null);

  const [viewsToday, setViewsToday] = useState<number | null>(null);
  const [viewsYesterday, setViewsYesterday] = useState<number | null>(null);
  const [topItemToday, setTopItemToday] = useState<string | null>(null);
  const [topItemsWeek, setTopItemsWeek] = useState<{ name: string; count: number }[]>([]);
  const [topFilter, setTopFilter] = useState<string | null>(null);

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingAccent, setSavingAccent] = useState(false);
  const [savingDailyPush, setSavingDailyPush] = useState(false);
  const [dailyPushError, setDailyPushError] = useState<string | null>(null);
  const [dailyPushForm, setDailyPushForm] = useState<DailyPushForm>({
    mode: "select",
    itemId: null,
    name: "",
    desc: "",
    emoji: "⭐",
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/login?redirect=/dashboard");
        return;
      }
      const userId = session.user.id;
      const { data: restData, error: restErr } = await supabase
        .from("restaurants")
        .select("id, slug, name, template, accent_color")
        .eq("auth_user_id", userId)
        .single();
      if (restErr || !restData) {
        setLoading(false);
        return;
      }
      const rest = restData as Restaurant & { accent_color?: string | null };
      setRestaurant(rest);
      setAccentColor(rest.accent_color ?? null);

      const { data: itemsData } = await supabase
        .from("menu_items")
        .select(
          "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags",
        )
        .eq("restaurant_id", rest.id)
        .eq("aktiv", true)
        .order("name");
      setMenuItems((itemsData ?? []) as MenuItem[]);

      await loadAnalytics(rest.id);
      setLoading(false);
    });
  }, [router]);

  async function loadAnalytics(restaurantId: string) {
    const today = new Date();
    const startToday = new Date(today);
    startToday.setHours(0, 0, 0, 0);
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);

    const { data, error } = await supabase
      .from("analytics_events")
      .select("item_id, item_name, event_type, filter_key, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startWeek.toISOString());
    if (error || !data) return;

    const events = data as AnalyticsItem[];
    const todayEvents = events.filter(
      (e) => new Date(e.created_at) >= startToday,
    );
    const yesterdayEvents = events.filter(
      (e) =>
        new Date(e.created_at) >= startYesterday &&
        new Date(e.created_at) < startToday,
    );

    setViewsToday(todayEvents.length);
    setViewsYesterday(yesterdayEvents.length);

    const todayByItem = new Map<string, number>();
    for (const e of todayEvents) {
      if (!e.item_name) continue;
      const k = e.item_name;
      todayByItem.set(k, (todayByItem.get(k) ?? 0) + 1);
    }
    const sortedToday = [...todayByItem.entries()].sort((a, b) => b[1] - a[1]);
    setTopItemToday(sortedToday[0]?.[0] ?? null);

    const weekByItem = new Map<string, number>();
    for (const e of events) {
      if (!e.item_name) continue;
      const k = e.item_name;
      weekByItem.set(k, (weekByItem.get(k) ?? 0) + 1);
    }
    const sortedWeek = [...weekByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    setTopItemsWeek(sortedWeek);

    const byFilter = new Map<string, number>();
    for (const e of events) {
      if (!e.filter_key) continue;
      byFilter.set(e.filter_key, (byFilter.get(e.filter_key) ?? 0) + 1);
    }
    const sortedFilters = [...byFilter.entries()].sort((a, b) => b[1] - a[1]);
    setTopFilter(sortedFilters[0]?.[0] ?? null);
  }

  const handleTemplateChange = async (templateId: string) => {
    if (!restaurant) return;
    setSavingTemplate(true);
    await supabase
      .from("restaurants")
      .update({ template: templateId })
      .eq("id", restaurant.id);
    setRestaurant({ ...restaurant, template: templateId });
    setSavingTemplate(false);
  };

  const handleAccentSave = async () => {
    if (!restaurant || !accentColor) return;
    setSavingAccent(true);
    await supabase
      .from("restaurants")
      .update({ accent_color: accentColor })
      .eq("id", restaurant.id);
    setSavingAccent(false);
  };

  const handleDailyPushSave = async () => {
    if (!restaurant) return;
    setSavingDailyPush(true);
    setDailyPushError(null);
    try {
      let name = dailyPushForm.name.trim();
      let desc = dailyPushForm.desc.trim();
      let emoji = dailyPushForm.emoji.trim() || "⭐";

      if (dailyPushForm.mode === "select" && dailyPushForm.itemId) {
        const m = menuItems.find((m) => m.id === dailyPushForm.itemId);
        if (m) {
          name = m.name;
          desc = m.beschreibung ?? "";
        }
      }

      const today = todayIsoDate();
      await supabase
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
        );
    } catch (e: any) {
      setDailyPushError(e?.message ?? "Fehler beim Speichern.");
    }
    setSavingDailyPush(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5]">
        <p className="text-[#71717a] text-sm">Dashboard wird geladen …</p>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const accent = accentColor ?? "#111111";

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#1a1a1a] flex flex-col">
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col pb-20">
          <header className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div>
              <div className="text-[0.9rem] text-[#71717a]">Dashboard</div>
              <div className="text-[1.15rem] font-semibold">
                {restaurant.name}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full border border-[#e4e4e7] text-[0.7rem] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span>Online</span>
            </div>
          </header>

          <main className="flex-1 px-4 pb-4">
            {activeTab === "home" && (
              <HomeTab
                restaurantName={restaurant.name}
                accent={accent}
                viewsToday={viewsToday}
                viewsYesterday={viewsYesterday}
                topItemToday={topItemToday}
                onGoTo={(tab) => setActiveTab(tab)}
              />
            )}
            {activeTab === "design" && (
              <DesignTab
                restaurant={restaurant}
                accent={accent}
                accentColor={accentColor}
                onAccentChange={setAccentColor}
                onAccentSave={handleAccentSave}
                savingAccent={savingAccent}
                onTemplateChange={handleTemplateChange}
                savingTemplate={savingTemplate}
              />
            )}
            {activeTab === "today" && (
              <TodayTab
                form={dailyPushForm}
                setForm={setDailyPushForm}
                menuItems={menuItems}
                saving={savingDailyPush}
                error={dailyPushError}
                onSave={handleDailyPushSave}
              />
            )}
            {activeTab === "stats" && (
              <StatsTab
                accent={accent}
                topItemsWeek={topItemsWeek}
                viewsToday={viewsToday}
                viewsYesterday={viewsYesterday}
                topFilter={topFilter}
              />
            )}
          </main>

          <nav className="fixed bottom-0 left-0 right-0 border-t border-[#e4e4e7] bg-white/95 backdrop-blur">
            <div className="max-w-[430px] mx-auto flex items-center justify-around py-2">
              <BottomNavButton
                icon="🏠"
                label="Home"
                active={activeTab === "home"}
                onClick={() => setActiveTab("home")}
              />
              <BottomNavButton
                icon="🎨"
                label="Design"
                active={activeTab === "design"}
                onClick={() => setActiveTab("design")}
              />
              <BottomNavButton
                icon="📅"
                label="Heute"
                active={activeTab === "today"}
                onClick={() => setActiveTab("today")}
              />
              <BottomNavButton
                icon="📊"
                label="Stats"
                active={activeTab === "stats"}
                onClick={() => setActiveTab("stats")}
              />
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

function BottomNavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl"
      style={{
        color: active ? "#111111" : "#a1a1aa",
        backgroundColor: active ? "#f4f4f5" : "transparent",
      }}
    >
      <span className="text-[1.2rem] leading-none">{icon}</span>
      <span className="text-[0.7rem] font-semibold">{label}</span>
    </button>
  );
}

function HomeTab({
  restaurantName,
  accent,
  viewsToday,
  viewsYesterday,
  topItemToday,
  onGoTo,
}: {
  restaurantName: string;
  accent: string;
  viewsToday: number | null;
  viewsYesterday: number | null;
  topItemToday: string | null;
  onGoTo: (tab: TabKey) => void;
}) {
  const delta =
    viewsToday !== null && viewsYesterday !== null
      ? viewsToday - viewsYesterday
      : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[1.3rem] font-semibold">
          👋 Hallo, {restaurantName}
        </div>
        <div className="mt-1 text-[0.82rem] text-[#71717a]">
          Kurzer Überblick über deine digitale Karte.
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e4e4e7] px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[#a1a1aa]">
            Aufrufe heute
          </div>
          <div className="text-[1.4rem] font-semibold">
            {viewsToday ?? "–"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] text-[#a1a1aa]">vs. gestern</div>
          <div
            className="text-[0.8rem] font-semibold"
            style={{ color: delta !== null && delta >= 0 ? "#16a34a" : "#ef4444" }}
          >
            {delta === null ? "–" : delta >= 0 ? `+${delta}` : delta}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e4e4e7] px-4 py-3">
        <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[#a1a1aa]">
          Meistgeklicktes Item heute
        </div>
        <div className="mt-1 text-[0.96rem] font-semibold">
          {topItemToday ?? "Noch keine Daten für heute"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <QuickLinkCard
          label="Design"
          icon="🎨"
          accent={accent}
          onClick={() => onGoTo("design")}
        />
        <QuickLinkCard
          label="Heute"
          icon="📅"
          accent={accent}
          onClick={() => onGoTo("today")}
        />
        <QuickLinkCard
          label="Stats"
          icon="📊"
          accent={accent}
          onClick={() => onGoTo("stats")}
        />
      </div>
    </div>
  );
}

function QuickLinkCard({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: string;
  label: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl px-3 py-3 text-left bg-white border border-[#e4e4e7] flex flex-col gap-1"
    >
      <span className="text-[1.4rem]">{icon}</span>
      <span className="text-[0.8rem] font-semibold">{label}</span>
      <span
        className="mt-1 h-[2px] rounded-full"
        style={{ backgroundColor: accent }}
      />
    </button>
  );
}

function DesignTab({
  restaurant,
  accent,
  accentColor,
  onAccentChange,
  onAccentSave,
  savingAccent,
  onTemplateChange,
  savingTemplate,
}: {
  restaurant: Restaurant & { accent_color?: string | null };
  accent: string;
  accentColor: string | null;
  onAccentChange: (v: string) => void;
  onAccentSave: () => void;
  savingAccent: boolean;
  onTemplateChange: (id: string) => void;
  savingTemplate: boolean;
}) {
  return (
    <div className="space-y-5">
      <section>
        <div className="text-[0.9rem] font-semibold mb-1">🎨 Template</div>
        <div className="text-[0.78rem] text-[#71717a] mb-3">
          Wähle das Layout, das am besten zu deinem Konzept passt.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATE_CARDS.map((tpl) => {
            const active = restaurant.template === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onTemplateChange(tpl.id)}
                className="rounded-2xl px-3 py-3 flex items-center gap-2 text-left border"
                style={{
                  borderColor: active ? accent : "#e4e4e7",
                  backgroundColor: active ? "#f5f5f4" : "#ffffff",
                }}
              >
                <span className="text-[1.3rem]">{tpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] font-semibold truncate">
                    {tpl.label}
                  </div>
                  {active && (
                    <div className="text-[0.7rem] text-[#16a34a] mt-0.5 flex items-center gap-1">
                      <span>✓</span>
                      <span>Aktiv</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {savingTemplate && (
          <div className="mt-1 text-[0.7rem] text-[#71717a]">
            Template wird gespeichert …
          </div>
        )}
      </section>

      <section>
        <div className="text-[0.9rem] font-semibold mb-1">🎯 Akzentfarbe</div>
        <div className="text-[0.78rem] text-[#71717a] mb-3">
          Bestimmt Buttons, Badges und Highlights.
        </div>
        <div className="flex gap-2">
          {ACCENT_COLORS.map((c) => {
            const active = accentColor === c.value;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onAccentChange(c.value)}
                className="flex-1 rounded-full px-2 py-2 border flex flex-col items-center gap-1"
                style={{
                  borderColor: active ? accent : "#e4e4e7",
                  backgroundColor: active ? "#f5f5f4" : "#ffffff",
                }}
              >
                <span
                  className="w-6 h-6 rounded-full border border-[#e4e4e7]"
                  style={{ backgroundColor: c.value }}
                />
                <span className="text-[0.7rem] font-semibold">{c.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onAccentSave}
          disabled={!accentColor || savingAccent}
          className="mt-3 w-full rounded-2xl py-2.5 text-[0.8rem] font-semibold text-white"
          style={{ backgroundColor: accent, opacity: !accentColor ? 0.5 : 1 }}
        >
          {savingAccent ? "Speichert …" : "Akzentfarbe speichern"}
        </button>
      </section>
    </div>
  );
}

function TodayTab({
  form,
  setForm,
  menuItems,
  saving,
  error,
  onSave,
}: {
  form: DailyPushForm;
  setForm: (f: DailyPushForm) => void;
  menuItems: MenuItem[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[0.9rem] font-semibold mb-1">📅 Tagesempfehlung</div>
        <div className="text-[0.78rem] text-[#71717a]">
          Wähle ein Gericht für heute oder gib eine eigene Empfehlung ein.
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e4e4e7] px-4 py-3">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                mode: "select",
              })
            }
            className="flex-1 rounded-full py-1.5 text-[0.78rem] font-semibold border"
            style={{
              backgroundColor: form.mode === "select" ? "#111111" : "#ffffff",
              color: form.mode === "select" ? "#ffffff" : "#111111",
              borderColor: "#111111",
            }}
          >
            Aus Karte wählen
          </button>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                mode: "manual",
              })
            }
            className="flex-1 rounded-full py-1.5 text-[0.78rem] font-semibold border"
            style={{
              backgroundColor: form.mode === "manual" ? "#111111" : "#ffffff",
              color: form.mode === "manual" ? "#ffffff" : "#111111",
              borderColor: "#111111",
            }}
          >
            Manuell
          </button>
        </div>

        {form.mode === "select" ? (
          <div className="space-y-2">
            <label className="text-[0.75rem] text-[#71717a] font-semibold">
              Gericht
            </label>
            <select
              className="w-full rounded-xl border border-[#e4e4e7] px-3 py-2 text-[0.8rem] bg-white"
              value={form.itemId ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  itemId: e.target.value || null,
                })
              }
            >
              <option value="">Bitte wählen …</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="text-[0.75rem] text-[#71717a] font-semibold">
                Emoji
              </label>
              <input
                className="mt-1 w-16 rounded-xl border border-[#e4e4e7] px-2 py-1 text-[1.2rem]"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[0.75rem] text-[#71717a] font-semibold">
                Name
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-[#e4e4e7] px-3 py-2 text-[0.8rem]"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[0.75rem] text-[#71717a] font-semibold">
                Beschreibung
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-[#e4e4e7] px-3 py-2 text-[0.8rem]"
                rows={3}
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-2 text-[0.75rem] text-[#dc2626]">{error}</p>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="mt-4 w-full rounded-2xl py-2.5 text-[0.8rem] font-semibold text-white bg-[#111111]"
        >
          {saving ? "Speichert …" : "Tagesempfehlung speichern"}
        </button>
      </div>
    </div>
  );
}

function StatsTab({
  accent,
  topItemsWeek,
  viewsToday,
  viewsYesterday,
  topFilter,
}: {
  accent: string;
  topItemsWeek: { name: string; count: number }[];
  viewsToday: number | null;
  viewsYesterday: number | null;
  topFilter: string | null;
}) {
  const delta =
    viewsToday !== null && viewsYesterday !== null
      ? viewsToday - viewsYesterday
      : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[0.9rem] font-semibold mb-1">📊 Stats</div>
        <div className="text-[0.78rem] text-[#71717a]">
          Ein schneller Blick auf die Performance dieser Woche.
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e4e4e7] px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[#a1a1aa]">
            Aufrufe heute
          </div>
          <div className="text-[1.4rem] font-semibold">
            {viewsToday ?? "–"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] text-[#a1a1aa]">vs. gestern</div>
          <div
            className="text-[0.8rem] font-semibold"
            style={{ color: delta !== null && delta >= 0 ? "#16a34a" : "#ef4444" }}
          >
            {delta === null ? "–" : delta >= 0 ? `+${delta}` : delta}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e4e4e7] px-4 py-3">
        <div className="text-[0.8rem] font-semibold mb-2">
          Top 5 Items (diese Woche)
        </div>
        <div className="space-y-1.5">
          {topItemsWeek.length === 0 && (
            <p className="text-[0.78rem] text-[#71717a]">
              Noch keine Daten für diese Woche.
            </p>
          )}
          {topItemsWeek.map((it, idx) => (
            <div
              key={it.name}
              className="flex items-center justify-between text-[0.78rem]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full text-[0.7rem] flex items-center justify-center"
                  style={{
                    backgroundColor: idx === 0 ? accent : "#f4f4f5",
                    color: idx === 0 ? "#ffffff" : "#71717a",
                  }}
                >
                  {idx + 1}
                </span>
                <span className="truncate max-w-[220px]">{it.name}</span>
              </div>
              <span className="font-mono text-[#71717a]">{it.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e4e4e7] px-4 py-3">
        <div className="text-[0.8rem] font-semibold mb-1">
          Meistgenutzter Filter
        </div>
        <div className="text-[0.9rem]">
          {topFilter ? topFilter.toUpperCase() : "Noch keine Filterdaten"}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@/lib/supabase";

const RED = "#C0392B";
const RESTAURANT_SLUG = "goldene-stunde";

const TEMPLATES = [
  { id: "bar-soleil", label: "Bar Soleil – Dark Luxury" },
  { id: "kiosk-no7", label: "Kiosk No.7 – Street Food" },
  { id: "compound-cafe", label: "Compound Café – Industrial" },
  { id: "nami-sushi", label: "Nami Sushi – Zen" },
  { id: "da-mario", label: "Da Mario – Trattoria" },
  { id: "roots", label: "Roots Plant Kitchen – Vegan" },
];

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(price);
}

const emptyForm = {
  name: "",
  beschreibung: "",
  preis: "",
  kategorie: "",
  tags: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<boolean | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(!!s);
      if (!s) {
        router.replace("/login?redirect=/dashboard");
        setLoading(false);
        return;
      }
      loadData();
    });
  }, [router]);

  async function loadData() {
    const { data: restData, error: restErr } = await supabase
      .from("restaurants")
      .select("id, slug, name, template")
      .eq("slug", RESTAURANT_SLUG)
      .single();
    if (restErr || !restData) {
      setLoading(false);
      return;
    }
    setRestaurant(restData as Restaurant);
    const { data: itemsData, error: itemsErr } = await supabase
      .from("menu_items")
      .select("id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags")
      .eq("restaurant_id", (restData as Restaurant).id)
      .order("name");
    if (!itemsErr) setItems((itemsData ?? []) as MenuItem[]);
    setLoading(false);
  }

  async function handleToggleAktiv(item: MenuItem) {
    setToggleError(null);
    setTogglingId(item.id);
    const newAktiv = !item.aktiv;
    const { error } = await supabase
      .from("menu_items")
      .update({ aktiv: newAktiv })
      .eq("id", item.id);
    setTogglingId(null);
    if (error) {
      setToggleError(`Speichern fehlgeschlagen: ${error.message}`);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, aktiv: newAktiv } : i)));
  }

  function openAdd() {
    setEditItem(null);
    setForm(emptyForm);
    setFormError("");
    setModal("add");
  }

  function openEdit(item: MenuItem) {
    setEditItem(item);
    setForm({
      name: item.name,
      beschreibung: item.beschreibung ?? "",
      preis: String(item.preis),
      kategorie: item.kategorie ?? "",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
    });
    setFormError("");
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditItem(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const preisNum = parseFloat(form.preis.replace(",", "."));
    if (isNaN(preisNum) || preisNum < 0) {
      setFormError("Bitte einen gültigen Preis eingeben.");
      return;
    }
    const tagsArr = form.tags
      ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : null;
    setSaving(true);
    if (modal === "add" && restaurant) {
      const { error } = await supabase.from("menu_items").insert({
        restaurant_id: restaurant.id,
        name: form.name.trim(),
        beschreibung: form.beschreibung.trim() || null,
        preis: preisNum,
        kategorie: form.kategorie.trim() || "Sonstiges",
        tags: tagsArr,
        aktiv: true,
      });
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
    } else if (modal === "edit" && editItem) {
      const { error } = await supabase
        .from("menu_items")
        .update({
          name: form.name.trim(),
          beschreibung: form.beschreibung.trim() || null,
          preis: preisNum,
          kategorie: form.kategorie.trim() || "Sonstiges",
          tags: tagsArr,
        })
        .eq("id", editItem.id);
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    closeModal();
    loadData();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setDeleteConfirm(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
        <p className="text-[#6b7280]">Wird geladen…</p>
      </div>
    );
  }

  if (!session || !restaurant) {
    return null;
  }

  const activeCount = items.filter((i) => i.aktiv).length;
  const inactiveCount = items.length - activeCount;

  const categories = [
    ...new Set(items.map((i) => (i.kategorie?.trim() || "Sonstiges"))),
  ].sort();
  const filteredItems =
    activeCategory === null
      ? items
      : items.filter((i) => (i.kategorie?.trim() || "Sonstiges") === activeCategory);

  return (
    <div
      className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a]"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <header className="border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: RED }}>
              {restaurant.name}
            </h1>
            <p className="text-sm text-[#6b7280]">Dashboard · Speisekarte verwalten</p>
          </div>
          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
            className="text-sm text-[#6b7280] hover:text-[#1a1a1a]"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 1. Übersicht */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6b7280]">Gerichte gesamt</p>
            <p className="text-2xl font-semibold mt-1">{items.length}</p>
          </div>
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6b7280]">Aktive Gerichte</p>
            <p className="text-2xl font-semibold mt-1" style={{ color: RED }}>{activeCount}</p>
          </div>
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6b7280]">Inaktive Gerichte</p>
            <p className="text-2xl font-semibold mt-1 text-[#6b7280]">{inactiveCount}</p>
          </div>
          <div className="sm:col-span-3 rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm flex flex-col gap-2">
            <p className="text-sm text-[#6b7280]">Template</p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={restaurant.template ?? "bar-soleil"}
                onChange={async (e) => {
                  const value = e.target.value;
                  if (!restaurant) return;
                  const { error } = await supabase
                    .from("restaurants")
                    .update({ template: value })
                    .eq("id", restaurant.id);
                  if (!error) {
                    setRestaurant({ ...restaurant, template: value });
                  }
                }}
                className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#9ca3af]">
                Vorschau unter <code className="font-mono text-[11px] text-[#4b5563]">/{restaurant.slug}</code>
              </span>
            </div>
          </div>
        </section>

        {/* 2. Kategorie-Tabs + Gerichtsliste */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Gerichte</h2>
            <button
              type="button"
              onClick={openAdd}
              className="rounded-lg px-4 py-2 text-white text-sm font-medium"
              style={{ backgroundColor: RED }}
            >
              Gericht hinzufügen
            </button>
          </div>

          {/* Kategorien als Tabs */}
          {categories.length > 0 && (
            <div className="px-4 py-3 border-b border-[#e5e7eb] bg-[#f9fafb] overflow-x-auto">
              <div className="flex gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: activeCategory === null ? RED : "transparent",
                    color: activeCategory === null ? "#fff" : "#6b7280",
                  }}
                >
                  Alle
                </button>
                {categories.map((kat) => (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setActiveCategory(kat)}
                    className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    style={{
                      backgroundColor: activeCategory === kat ? RED : "transparent",
                      color: activeCategory === kat ? "#fff" : "#6b7280",
                    }}
                  >
                    {kat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {toggleError && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-50 text-sm text-red-700">
              {toggleError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-sm text-[#6b7280]">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Kategorie</th>
                  <th className="px-6 py-3 font-medium">Preis</th>
                  <th className="px-6 py-3 font-medium">Aktiv</th>
                  <th className="px-6 py-3 font-medium text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[#6b7280]">
                      {items.length === 0
                        ? "Noch keine Gerichte. Klicke auf „Gericht hinzufügen“."
                        : `Keine Gerichte in „${activeCategory ?? "Alle"}“.`}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isToggling = togglingId === item.id;
                    return (
                      <tr key={item.id} className="border-b border-[#e5e7eb] hover:bg-[#f9fafb]">
                        <td className="px-6 py-3 font-medium">{item.name}</td>
                        <td className="px-6 py-3 text-[#6b7280]">{item.kategorie}</td>
                        <td className="px-6 py-3">{formatPrice(item.preis)}</td>
                        <td className="px-6 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleAktiv(item)}
                            disabled={isToggling}
                            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#C0392B] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-wait"
                            style={{
                              backgroundColor: item.aktiv ? RED : "#d1d5db",
                            }}
                            role="switch"
                            aria-checked={item.aktiv}
                            aria-busy={isToggling}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow absolute top-0.5 left-0.5 transition-transform duration-200 ${
                                item.aktiv ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="text-sm font-medium mr-3 hover:underline"
                            style={{ color: RED }}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(item.id)}
                            className="text-sm text-[#6b7280] hover:text-red-600"
                          >
                            Löschen
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal: Hinzufügen / Bearbeiten */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e5e7eb]">
              <h3 className="text-lg font-semibold">
                {modal === "add" ? "Gericht hinzufügen" : "Gericht bearbeiten"}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Beschreibung</label>
                <textarea
                  value={form.beschreibung}
                  onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Preis (€) *</label>
                <input
                  type="text"
                  value={form.preis}
                  onChange={(e) => setForm((f) => ({ ...f, preis: e.target.value }))}
                  placeholder="9.90"
                  required
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Kategorie</label>
                <input
                  type="text"
                  value={form.kategorie}
                  onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target.value }))}
                  placeholder="z. B. Vorspeisen, Hauptgerichte"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Tags (kommagetrennt)</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="vegetarisch, scharf"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 focus:border-[#C0392B] focus:outline-none focus:ring-1 focus:ring-[#C0392B]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-white font-medium disabled:opacity-60"
                  style={{ backgroundColor: RED }}
                >
                  {saving ? "Speichern…" : "Speichern"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 border border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-2">Gericht löschen?</h3>
            <p className="text-sm text-[#6b7280] mb-4">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg px-4 py-2 text-white font-medium bg-red-600 hover:bg-red-700"
              >
                Löschen
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg px-4 py-2 border border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
