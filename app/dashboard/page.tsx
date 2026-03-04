"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@/lib/supabase";

const RED = "#C0392B";
const RESTAURANT_SLUG = "goldene-stunde";

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
      .select("id, slug, name")
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
