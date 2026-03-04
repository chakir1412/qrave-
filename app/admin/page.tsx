"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Restaurant } from "@/lib/supabase";

const BG = "#1A1A1A";
const CARD = "#242424";
const RED = "#C0392B";
const ADMIN_EMAIL = "chakir.elhaji@gmail.com";

type NavTab = "overview" | "restaurants" | "partners" | "analytics";

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE");
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<NavTab>("overview");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [savingToggleId, setSavingToggleId] = useState<string | null>(null);

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmError, setCrmError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      if (!user) {
        router.replace("/login?redirect=/admin");
        setLoading(false);
        return;
      }
      const email = (user.email ?? "").trim().toLowerCase();
      setCurrentEmail(email);
      if (email !== ADMIN_EMAIL.toLowerCase()) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      loadRestaurants().finally(() => setLoading(false));
    });
  }, [router]);

  async function loadRestaurants() {
    const { data, error } = await supabase
      .from("restaurants")
      .select(
        "id, name, slug, stadt, adresse, telefon, email, aktiv, ansprechpartner_name, notizen, letzter_kontakt, naechster_termin, vertragsstatus, sticker_anzahl, scans_heute, umsatz_monat, aktive_partner"
      )
      .order("name");
    if (error) {
      console.error("Supabase restaurants:", error);
      return;
    }
    setRestaurants((data ?? []) as Restaurant[]);
  }

  const metrics = useMemo(() => {
    const totalRestaurants = restaurants.length;
    const totalScansToday =
      restaurants.reduce((sum, r) => sum + (r.scans_heute ?? 0), 0) ?? 0;
    const totalRevenue =
      restaurants.reduce((sum, r) => sum + (r.umsatz_monat ?? 0), 0) ?? 0;
    const totalActivePartners =
      restaurants.reduce((sum, r) => sum + (r.aktive_partner ?? 0), 0) ?? 0;
    return { totalRestaurants, totalScansToday, totalRevenue, totalActivePartners };
  }, [restaurants]);

  async function handleToggleActive(r: Restaurant) {
    setSavingToggleId(r.id);
    const newAktiv = !r.aktiv;
    const { error } = await supabase
      .from("restaurants")
      .update({ aktiv: newAktiv })
      .eq("id", r.id);
    setSavingToggleId(null);
    if (error) {
      console.error("Toggle aktiv failed:", error);
      return;
    }
    setRestaurants((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, aktiv: newAktiv } : x))
    );
  }

  function openCrm(r: Restaurant) {
    setSelectedRestaurant(r);
    setCrmError("");
  }

  function updateCrmField<K extends keyof Restaurant>(key: K, value: Restaurant[K]) {
    setSelectedRestaurant((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveCrm() {
    if (!selectedRestaurant) return;
    setCrmSaving(true);
    setCrmError("");
    const {
      id,
      ansprechpartner_name,
      telefon,
      email,
      notizen,
      letzter_kontakt,
      naechster_termin,
      vertragsstatus,
      sticker_anzahl,
    } = selectedRestaurant;
    const { error } = await supabase
      .from("restaurants")
      .update({
        ansprechpartner_name,
        telefon,
        email,
        notizen,
        letzter_kontakt,
        naechster_termin,
        vertragsstatus,
        sticker_anzahl,
      })
      .eq("id", id);
    setCrmSaving(false);
    if (error) {
      setCrmError(error.message);
      return;
    }
    setRestaurants((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...selectedRestaurant } : r))
    );
    setSelectedRestaurant(null);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm text-zinc-400"
        style={{ backgroundColor: BG, fontFamily: "var(--font-dm-sans), sans-serif" }}
      >
        Lädt Admin-Dashboard…
      </div>
    );
  }

  if (forbidden) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm text-zinc-400"
        style={{ backgroundColor: BG, fontFamily: "var(--font-dm-sans), sans-serif" }}
      >
        <div className="text-center space-y-1">
          <p>Kein Zugriff. Melde dich mit deinem Admin-Account an.</p>
          {currentEmail && (
            <p className="text-xs text-zinc-500">
              Eingeloggt als <span className="font-mono">{currentEmail}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-zinc-100"
      style={{ backgroundColor: BG, fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      {/* Header */}
      <header
        className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between"
        style={{ backgroundColor: "#151515" }}
      >
        <div>
          <h1 className="text-xl font-semibold">QRAVE Admin</h1>
          <p className="text-xs text-zinc-500">Backoffice für Restaurants & Partner</p>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
          className="text-xs text-zinc-400 hover:text-zinc-100"
        >
          Abmelden
        </button>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-60 border-r border-zinc-800 min-h-[calc(100vh-64px)] px-4 py-6">
          <nav className="space-y-1 text-sm">
            {[
              { id: "overview", label: "Übersicht" },
              { id: "restaurants", label: "Restaurants" },
              { id: "partners", label: "Partner" },
              { id: "analytics", label: "Analytics" },
            ].map((item) => {
              const isActive = tab === (item.id as NavTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as NavTab)}
                  className="w-full text-left px-3 py-2 rounded-md transition-colors"
                  style={{
                    backgroundColor: isActive ? CARD : "transparent",
                    color: isActive ? "#fff" : "#9ca3af",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-8 py-6 space-y-6">
          {tab === "overview" && (
            <>
              <section className="grid grid-cols-4 gap-4">
                <div
                  className="rounded-xl p-4 shadow-sm"
                  style={{ backgroundColor: CARD }}
                >
                  <p className="text-xs text-zinc-500">Restaurants gesamt</p>
                  <p className="text-2xl font-semibold mt-1">
                    {metrics.totalRestaurants}
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 shadow-sm"
                  style={{ backgroundColor: CARD }}
                >
                  <p className="text-xs text-zinc-500">Scans heute</p>
                  <p className="text-2xl font-semibold mt-1">
                    {metrics.totalScansToday}
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 shadow-sm"
                  style={{ backgroundColor: CARD }}
                >
                  <p className="text-xs text-zinc-500">Umsatz Monat</p>
                  <p className="text-2xl font-semibold mt-1">
                    {currencyFormatter.format(metrics.totalRevenue)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 shadow-sm"
                  style={{ backgroundColor: CARD }}
                >
                  <p className="text-xs text-zinc-500">Aktive Partner</p>
                  <p className="text-2xl font-semibold mt-1">
                    {metrics.totalActivePartners}
                  </p>
                </div>
              </section>

              <section
                className="rounded-xl shadow-sm overflow-hidden"
                style={{ backgroundColor: CARD }}
              >
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Restaurants</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                        <th className="px-6 py-2 text-left font-medium">Name</th>
                        <th className="px-6 py-2 text-left font-medium">Stadt</th>
                        <th className="px-6 py-2 text-left font-medium">Slug</th>
                        <th className="px-6 py-2 text-left font-medium">Aktiv</th>
                        <th className="px-6 py-2 text-right font-medium">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurants.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-6 text-center text-xs text-zinc-500"
                          >
                            Noch keine Restaurants angelegt.
                          </td>
                        </tr>
                      ) : (
                        restaurants.map((r) => {
                          const isToggling = savingToggleId === r.id;
                          return (
                            <tr
                              key={r.id}
                              className="border-b border-zinc-800 hover:bg-zinc-800/40"
                            >
                              <td className="px-6 py-2 text-sm">{r.name}</td>
                              <td className="px-6 py-2 text-xs text-zinc-400">
                                {r.stadt || "—"}
                              </td>
                              <td className="px-6 py-2 text-xs text-zinc-400">
                                {r.slug}
                              </td>
                              <td className="px-6 py-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(r)}
                                  disabled={isToggling}
                                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60 disabled:cursor-wait"
                                  style={{
                                    backgroundColor: r.aktiv ? RED : "#3f3f46",
                                  }}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-zinc-100 shadow absolute top-0.5 left-0.5 transition-transform duration-200 ${
                                      r.aktiv ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              </td>
                              <td className="px-6 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openCrm(r)}
                                  className="text-xs font-medium"
                                  style={{ color: RED }}
                                >
                                  CRM öffnen
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
            </>
          )}

          {tab === "restaurants" && (
            <section
              className="rounded-xl shadow-sm p-6 space-y-4"
              style={{ backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold mb-2">Restaurants</h2>
              <p className="text-xs text-zinc-500 mb-4">
                CRM-Details pro Restaurant über „CRM öffnen“ in der Übersicht.
              </p>
              {/* Für später: erweiterte Listen-/Filteransicht */}
              <p className="text-xs text-zinc-500">
                Erweiterte Restaurant-Ansicht folgt. Aktuell bitte die Übersicht
                nutzen.
              </p>
            </section>
          )}

          {tab === "partners" && (
            <section
              className="rounded-xl shadow-sm p-6 space-y-4"
              style={{ backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold">Partner</h2>
              <p className="text-xs text-zinc-500">
                Hier kannst du später Partner, Placements und Partner-Slots verwalten.
              </p>
            </section>
          )}

          {tab === "analytics" && (
            <section
              className="rounded-xl shadow-sm p-6 space-y-4"
              style={{ backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold">Analytics</h2>
              <p className="text-xs text-zinc-500">
                Analytics-Dashboards (Scans, Conversions, Umsatz) folgen.
              </p>
            </section>
          )}
        </main>
      </div>

      {/* CRM Modal */}
      {selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-2xl rounded-2xl shadow-xl border border-zinc-800 overflow-hidden"
            style={{ backgroundColor: CARD }}
          >
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  CRM · {selectedRestaurant.name}
                </h3>
                <p className="text-xs text-zinc-500">
                  {selectedRestaurant.stadt || "Stadt unbekannt"} ·{" "}
                  {selectedRestaurant.slug}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRestaurant(null)}
                className="text-xs text-zinc-400 hover:text-zinc-100"
              >
                Schließen
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {crmError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                  {crmError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Ansprechpartner Name
                  </label>
                  <input
                    value={selectedRestaurant.ansprechpartner_name ?? ""}
                    onChange={(e) =>
                      updateCrmField("ansprechpartner_name", e.target.value || null)
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Telefon</label>
                  <input
                    value={selectedRestaurant.telefon ?? ""}
                    onChange={(e) =>
                      updateCrmField("telefon", e.target.value || null)
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={selectedRestaurant.email ?? ""}
                    onChange={(e) =>
                      updateCrmField("email", e.target.value || null)
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Sticker Anzahl installiert
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={selectedRestaurant.sticker_anzahl ?? 0}
                    onChange={(e) =>
                      updateCrmField(
                        "sticker_anzahl",
                        Number.isNaN(parseInt(e.target.value, 10))
                          ? 0
                          : parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Letzter Kontakt
                  </label>
                  <input
                    type="date"
                    value={
                      selectedRestaurant.letzter_kontakt?.slice(0, 10) ?? ""
                    }
                    onChange={(e) =>
                      updateCrmField(
                        "letzter_kontakt",
                        e.target.value ? e.target.value : null
                      )
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Aktuell: {formatDate(selectedRestaurant.letzter_kontakt)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Nächster Termin
                  </label>
                  <input
                    type="date"
                    value={
                      selectedRestaurant.naechster_termin?.slice(0, 10) ?? ""
                    }
                    onChange={(e) =>
                      updateCrmField(
                        "naechster_termin",
                        e.target.value ? e.target.value : null
                      )
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Aktuell: {formatDate(selectedRestaurant.naechster_termin)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Vertragsstatus
                  </label>
                  <select
                    value={selectedRestaurant.vertragsstatus ?? "aktiv"}
                    onChange={(e) =>
                      updateCrmField(
                        "vertragsstatus",
                        e.target.value as Restaurant["vertragsstatus"]
                      )
                    }
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="aktiv">Aktiv</option>
                    <option value="pausiert">Pausiert</option>
                    <option value="gekündigt">Gekündigt</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Notizen</label>
                <textarea
                  rows={4}
                  value={selectedRestaurant.notizen ?? ""}
                  onChange={(e) =>
                    updateCrmField("notizen", e.target.value || null)
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedRestaurant(null)}
                className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveCrm}
                disabled={crmSaving}
                className="rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: RED }}
              >
                {crmSaving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

