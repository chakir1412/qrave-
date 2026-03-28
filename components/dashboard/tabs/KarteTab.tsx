"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { DailyPush } from "@/lib/supabase";
import type { MenuItem } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import {
  inferMainTabFromCategoryName,
  type ParsedMenuItemDto,
} from "@/lib/parse-menu";
import type { KarteSub } from "../types";
import { dash } from "../constants";
import { formatPreisEUR, todayIsoDate } from "../utils";
import {
  compareKategorieOrder,
  sortOrderIndexForKategorie,
} from "@/lib/category-sort-order";

const DASHBOARD_MENU_ITEM_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order";

function menuItemKategorieLabel(m: MenuItem): string {
  return m.kategorie?.trim() || "Sonstiges";
}

function normalizeEditorMainTab(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().toLowerCase();
  return t === "" ? null : t;
}

const EDITOR_MAIN_TAB_ORDER = ["speisen", "getraenke", "snacks"] as const;

function compareEditorMainTabKey(a: string, b: string): number {
  const order = EDITOR_MAIN_TAB_ORDER as readonly string[];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  const ra = ia === -1 ? 999 : ia;
  const rb = ib === -1 ? 999 : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, "de");
}

function editorMainTabChipLabel(tab: string, count: number): string {
  if (tab === "alle") return `Alle (${count})`;
  if (tab === "speisen") return `🍽 Speisen (${count})`;
  if (tab === "getraenke") return `🍺 Getränke (${count})`;
  if (tab === "snacks") return `🍟 Snacks (${count})`;
  const cap = tab.length > 0 ? tab.charAt(0).toUpperCase() + tab.slice(1) : tab;
  return `${cap} (${count})`;
}

type DailyForm = {
  mode: "select" | "manual";
  itemId: string | null;
  name: string;
  desc: string;
  emoji: string;
};

type Props = {
  slideClass: string;
  restaurantId: string;
  slug: string;
  menuItems: MenuItem[];
  onItemsChange: (items: MenuItem[]) => void;
  activeSub: KarteSub;
  onSubChange: (s: KarteSub) => void;
  onOpenEdit: (item: MenuItem) => void;
  onOpenCreateItem: (category: string) => void;
  onOpenAddCat: () => void;
  onOpenPreview: () => void;
  dailyPush: DailyPush | null;
  onDailyPushUpdated: (p: DailyPush | null) => void;
  dailyForm: DailyForm;
  setDailyForm: (f: DailyForm) => void;
  savingDaily: boolean;
  dailyError: string | null;
  onSaveDaily: () => Promise<void>;
  onToast: (msg: string) => void;
  guestNotiz: string;
  onGuestNotizChange: (v: string) => void;
  onSaveGuestNote: () => void;
};

type ImportPhase = "idle" | "reading" | "analyzing" | "review" | "error";

/** Bestehende Karte beim KI-Import */
type ImportExistingMode = "replace" | "add";
type CategoryBucket = ParsedMenuItemDto["main_tab"] | "unklar";

type ReviewRow = {
  id: string;
  name: string;
  beschreibung: string;
  preis: number;
  kategorie: string;
  main_tab: ParsedMenuItemDto["main_tab"];
  selected: boolean;
  category_confidence?: number;
};

type CategoryMap = Record<string, CategoryBucket>;

const ACCEPT_UPLOAD = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

function newReviewId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAllowedUploadFile(file: File): boolean {
  const n = file.name.toLowerCase();
  const t = file.type.toLowerCase();
  if (t === "application/pdf" || n.endsWith(".pdf")) return true;
  if (t === "image/png" || n.endsWith(".png")) return true;
  if (t === "image/jpeg" || t === "image/jpg" || n.endsWith(".jpg") || n.endsWith(".jpeg")) {
    return true;
  }
  return false;
}

async function extractTextFromPdf(file: File): Promise<string> {
  // Dynamic import: nur clientseitig beim Upload-Pfad laden.
  const pdfjsLib = await import("pdfjs-dist");
  // PDF.js Worker über eine fixe Public-URL laden (zuverlässiger als import.meta.url).
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) {
      fullText += `${pageText}\n`;
    }
  }
  return fullText;
}

function normalizeCategoryKey(category: string): string {
  return category.trim() || "Sonstiges";
}

function buildInitialCategoryMap(rows: ReviewRow[]): CategoryMap {
  const byCategory = new Map<
    string,
    { count: number; confSum: number; tabVotes: Record<ParsedMenuItemDto["main_tab"], number> }
  >();

  for (const r of rows) {
    const k = normalizeCategoryKey(r.kategorie);
    if (!byCategory.has(k)) {
      byCategory.set(k, {
        count: 0,
        confSum: 0,
        tabVotes: { speisen: 0, getraenke: 0, snacks: 0 },
      });
    }
    const cur = byCategory.get(k)!;
    cur.count += 1;
    cur.confSum += r.category_confidence ?? 0.5;
    cur.tabVotes[r.main_tab] += 1;
  }

  const out: CategoryMap = {};
  for (const [category, v] of byCategory.entries()) {
    const avgConf = v.confSum / Math.max(1, v.count);
    const voteMain = (Object.entries(v.tabVotes).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "speisen") as ParsedMenuItemDto["main_tab"];
    const mapped = inferMainTabFromCategoryName(category);
    if (avgConf <= 0.45) {
      out[category] = "unklar";
    } else {
      out[category] = mapped ?? voteMain;
    }
  }
  return out;
}

function applyCategoryMapToMainTabs(rows: ReviewRow[], catMap: CategoryMap): ReviewRow[] {
  return rows.map((r) => {
    const key = normalizeCategoryKey(r.kategorie);
    const bucket = catMap[key];
    return {
      ...r,
      main_tab: bucket && bucket !== "unklar" ? bucket : r.main_tab,
    };
  });
}

export function KarteTab({
  slideClass,
  restaurantId,
  slug,
  menuItems,
  onItemsChange,
  activeSub,
  onSubChange,
  onOpenEdit,
  onOpenCreateItem,
  onOpenAddCat,
  onOpenPreview,
  dailyPush,
  onDailyPushUpdated,
  dailyForm,
  setDailyForm,
  savingDaily,
  dailyError,
  onSaveDaily,
  onToast,
  guestNotiz,
  onGuestNotizChange,
  onSaveGuestNote,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);

  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [submittingImport, setSubmittingImport] = useState(false);
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({});
  /** Ersetzen vs. Hinzufügen — `null` bis der Nutzer aktiv eine Karte wählt */
  const [importMode, setImportMode] = useState<ImportExistingMode | null>(null);
  const [draftNewCategory, setDraftNewCategory] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [touchDragItemId, setTouchDragItemId] = useState<string | null>(null);
  const [swipeOpenItemId, setSwipeOpenItemId] = useState<string | null>(null);
  const itemTouchStartXRef = useRef<Record<string, number>>({});

  const [specialName, setSpecialName] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");

  const [portalReady, setPortalReady] = useState(false);
  const [deleteMenuConfirmOpen, setDeleteMenuConfirmOpen] = useState(false);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [showImportOverlay, setShowImportOverlay] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<string>("alle");
  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (activeSub !== "menu") {
      setDeleteMenuConfirmOpen(false);
      setShowImportOverlay(false);
    }
  }, [activeSub]);

  useEffect(() => {
    if (dailyPush) {
      setSpecialName(dailyPush.item_name);
      setSpecialPrice("");
    }
  }, [dailyPush]);

  const filteredMenuItems = useMemo(() => {
    if (activeMainTab === "alle") return menuItems;
    return menuItems.filter((i) => normalizeEditorMainTab(i.main_tab) === activeMainTab);
  }, [menuItems, activeMainTab]);

  const groupedForList = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const m of filteredMenuItems) {
      const k = m.kategorie || "Sonstiges";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    map.forEach((list) => {
      list.sort((a, b) => {
        const sa = a.sort_order ?? 99;
        const sb = b.sort_order ?? 99;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name, "de");
      });
    });
    return [...map.entries()].sort(([catA], [catB]) => compareKategorieOrder(catA, catB));
  }, [filteredMenuItems]);

  const editorCategoryNamesForList = useMemo(() => {
    const names = new Set<string>();
    for (const [cat] of groupedForList) names.add(cat);
    if (activeMainTab === "alle") {
      for (const c of extraCategories) names.add(c);
    }
    return [...names].sort(compareKategorieOrder);
  }, [groupedForList, extraCategories, activeMainTab]);

  const mainTabChips = useMemo((): string[] => {
    const keys = new Set(
      menuItems
        .map((m) => normalizeEditorMainTab(m.main_tab))
        .filter((x): x is string => x !== null),
    );
    return ["alle", ...[...keys].sort(compareEditorMainTabKey)];
  }, [menuItems]);

  useEffect(() => {
    if (importPhase === "review") return;
    if (activeMainTab !== "alle" && !mainTabChips.includes(activeMainTab)) {
      setActiveMainTab("alle");
    }
  }, [activeMainTab, mainTabChips, importPhase]);

  const reviewMainTabs = useMemo((): string[] => {
    const keys = new Set(
      reviewRows
        .map((r) => normalizeEditorMainTab(r.main_tab))
        .filter((x): x is string => x !== null),
    );
    return ["alle", ...[...keys].sort(compareEditorMainTabKey)];
  }, [reviewRows]);

  const filteredReviewRows = useMemo(() => {
    if (activeMainTab === "alle") return reviewRows;
    return reviewRows.filter((r) => normalizeEditorMainTab(r.main_tab) === activeMainTab);
  }, [reviewRows, activeMainTab]);

  const groupedReview = useMemo(() => {
    const map = new Map<string, ReviewRow[]>();
    for (const r of filteredReviewRows) {
      const k = r.kategorie.trim() || "Sonstiges";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => compareKategorieOrder(a, b));
  }, [filteredReviewRows]);

  const selectedCount = useMemo(() => reviewRows.filter((r) => r.selected).length, [reviewRows]);

  async function moveItemToCategory(itemId: string, nextCategory: string) {
    const next = nextCategory.trim();
    if (!next) return;
    const current = menuItems.find((m) => m.id === itemId);
    if (!current || current.kategorie === next) return;
    const { data, error } = await supabase
      .from("menu_items")
      .update({ kategorie: next, sort_order: sortOrderIndexForKategorie(next) })
      .eq("id", itemId)
      .select(DASHBOARD_MENU_ITEM_SELECT)
      .single();
    if (error || !data) {
      onToast(error?.message ?? "Kategoriewechsel fehlgeschlagen");
      return;
    }
    setExtraCategories((prev) => (prev.includes(next) ? prev : [...prev, next]));
    onItemsChange(menuItems.map((m) => (m.id === itemId ? (data as MenuItem) : m)));
  }

  async function renameCategory(oldName: string, nextName: string) {
    const oldTrim = oldName.trim();
    const nextTrim = nextName.trim();
    if (!oldTrim || !nextTrim || oldTrim === nextTrim) {
      setRenamingCategory(null);
      return;
    }
    const items = menuItems.filter((m) => (m.kategorie || "Sonstiges") === oldTrim);
    if (items.length === 0) {
      setRenamingCategory(null);
      return;
    }
    const ids = items.map((m) => m.id);
    const nextOrder = sortOrderIndexForKategorie(nextTrim);
    const { error } = await supabase
      .from("menu_items")
      .update({ kategorie: nextTrim, sort_order: nextOrder })
      .in("id", ids);
    if (error) {
      onToast(error.message ?? "Kategorie konnte nicht umbenannt werden");
      return;
    }
    onItemsChange(
      menuItems.map((m) =>
        ids.includes(m.id) ? { ...m, kategorie: nextTrim, sort_order: nextOrder } : m,
      ),
    );
    setExtraCategories((prev) => {
      const n = prev.filter((x) => x !== oldTrim);
      return n.includes(nextTrim) ? n : [...n, nextTrim];
    });
    setRenamingCategory(null);
    onToast("✓ Kategorie umbenannt");
  }

  function startRenameCategory(category: string) {
    setRenamingCategory(category);
    setRenamingValue(category);
  }

  function handleItemSwipeStart(itemId: string, x: number) {
    itemTouchStartXRef.current[itemId] = x;
  }

  function handleItemSwipeEnd(itemId: string, x: number) {
    const start = itemTouchStartXRef.current[itemId];
    if (typeof start !== "number") return;
    const dx = x - start;
    if (dx < -40) setSwipeOpenItemId(itemId);
    else if (dx > 25) setSwipeOpenItemId(null);
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
    if (error) {
      onToast(error.message ?? "Löschen fehlgeschlagen");
      return;
    }
    onItemsChange(menuItems.filter((m) => m.id !== itemId));
    setSwipeOpenItemId((prev) => (prev === itemId ? null : prev));
    onToast("🗑️ Gelöscht");
  }

  async function confirmDeleteFullMenu() {
    setDeletingMenu(true);
    try {
      const { error: itemsError } = await supabase
        .from("menu_items")
        .delete()
        .eq("restaurant_id", restaurantId);
      if (itemsError) {
        console.error("Delete menu_items failed:", itemsError);
        onToast("Fehler beim Löschen");
        return;
      }

      const { error: catsError } = await supabase
        .from("categories")
        .delete()
        .eq("restaurant_id", restaurantId);
      if (catsError) {
        console.error("Delete categories failed:", catsError);
      }

      onItemsChange([]);
      setExtraCategories([]);
      setDeleteMenuConfirmOpen(false);
      onToast("Speisekarte gelöscht");
    } finally {
      setDeletingMenu(false);
    }
  }

  async function toggleAktiv(item: MenuItem) {
    const { data, error } = await supabase
      .from("menu_items")
      .update({ aktiv: !item.aktiv })
      .eq("id", item.id)
      .select(DASHBOARD_MENU_ITEM_SELECT)
      .single();
    if (error || !data) {
      onToast(error?.message ?? "Update fehlgeschlagen");
      return;
    }
    const next = menuItems.map((x) => (x.id === item.id ? (data as MenuItem) : x));
    onItemsChange(next);
  }

  function commitParsedItems(bodyItems: ParsedMenuItemDto[]) {
    const sortedBody = [...bodyItems].sort((a, b) => {
      const c = compareKategorieOrder(a.kategorie, b.kategorie);
      if (c !== 0) return c;
      return a.name.localeCompare(b.name, "de");
    });
    const rows: ReviewRow[] = sortedBody.map((it) => ({
      id: newReviewId(),
      name: it.name,
      beschreibung: it.beschreibung,
      preis: it.preis,
      kategorie: it.kategorie,
      main_tab: it.main_tab,
      selected: true,
      category_confidence: it.category_confidence,
    }));
    const catMap = buildInitialCategoryMap(rows);
    const rowsWithTabs = applyCategoryMapToMainTabs(rows, catMap);
    setImportMode(menuItems.length === 0 ? "add" : null);
    setCategoryMap(catMap);
    setReviewRows(rowsWithTabs);
    setActiveMainTab("alle");
    setImportPhase("review");
    onToast(`✅ ${bodyItems.length} Gerichte erkannt`);
  }

  async function runImportFile(file: File) {
    if (!isAllowedUploadFile(file)) {
      onToast("Nur PDF oder JPG/PNG erlaubt.");
      return;
    }
    lastFileRef.current = file;
    setImportError(null);

    setImportPhase("reading");
    try {
      await file.arrayBuffer();
    } catch {
      setImportError("Datei konnte nicht gelesen werden.");
      setImportPhase("error");
      onToast("Datei konnte nicht gelesen werden.");
      return;
    }

    await new Promise((r) => window.setTimeout(r, 350));

    setImportPhase("analyzing");
    const fd = new FormData();
    const isPdf =
      file.type.toLowerCase() === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    fd.append("file", file);
    fd.append("restaurantId", restaurantId);

    if (isPdf) {
      const extractedText = await extractTextFromPdf(file);
      console.log("Extracted text length:", extractedText.length);
      fd.append("extractedText", extractedText);
    }

    try {
      const res = await fetch("/api/parse-menu", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as {
        items?: ParsedMenuItemDto[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(body.error ?? `Analyse fehlgeschlagen (${res.status})`);
      }
      if (!body.items?.length) {
        throw new Error("Keine Gerichte erkannt.");
      }

      commitParsedItems(body.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setImportError(msg);
      setImportPhase("error");
      onToast(msg);
    }
  }

  function closeImportOverlay() {
    setShowImportOverlay(false);
  }

  function openPdfImportFromOverlay() {
    closeImportOverlay();
    fileInputRef.current?.click();
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void runImportFile(file);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function cancelReview() {
    setReviewRows([]);
    setImportPhase("idle");
    setImportError(null);
    setCategoryMap({});
    setImportMode(null);
  }

  function updateReviewRow(id: string, patch: Partial<Omit<ReviewRow, "id">>) {
    setReviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function confirmImport() {
    const rows = reviewRows.filter((r) => r.selected);
    if (rows.length === 0) {
      onToast("Bitte mindestens ein Gericht auswählen.");
      return;
    }
    /** Explizite Wahl hat Vorrang — nicht auf „add“ zurückfallen, wenn lokal alles leer ist aber „Ersetzen“ gewählt (sonst kein Bulk-Delete in der DB). */
    const mode: ImportExistingMode | null =
      importMode === "replace" || importMode === "add"
        ? importMode
        : menuIsEmpty
          ? "add"
          : null;
    if (mode === null) {
      onToast("Bitte wähle: Speisekarte ersetzen oder hinzufügen.");
      return;
    }

    setSubmittingImport(true);
    try {
      if (mode === "replace") {
        const { error: delError } = await supabase
          .from("menu_items")
          .delete()
          .eq("restaurant_id", restaurantId);
        if (delError) {
          console.error("Replace delete failed:", delError);
          onToast("Fehler beim Ersetzen");
          return;
        }
      }

      const inserts = rows.map((r) => {
        const kat = r.kategorie.trim() || "Sonstiges";
        return {
          restaurant_id: restaurantId,
          name: r.name.trim(),
          beschreibung: r.beschreibung.trim() || null,
          preis: Number.isFinite(r.preis) && r.preis >= 0 ? r.preis : 0,
          kategorie: kat,
          aktiv: true,
          main_tab: r.main_tab,
          sort_order: sortOrderIndexForKategorie(kat),
        };
      });

      const { data, error } = await supabase
        .from("menu_items")
        .insert(inserts)
        .select(DASHBOARD_MENU_ITEM_SELECT);

      if (error || !data) {
        onToast(error?.message ?? "Import fehlgeschlagen");
        return;
      }

      const created = data as MenuItem[];
      if (mode === "replace") {
        onItemsChange(created);
      } else {
        onItemsChange([...menuItems, ...created]);
      }
      setReviewRows([]);
      setCategoryMap({});
      setImportPhase("idle");
      setImportError(null);
      setImportMode(null);
      onToast(
        mode === "replace"
          ? `✅ Speisekarte ersetzt — ${created.length} Gerichte`
          : `✅ ${created.length} Gerichte importiert`,
      );
      setActiveMainTab("alle");
    } finally {
      setSubmittingImport(false);
    }
  }

  async function setSpecialFromForm() {
    const name = specialName.trim();
    const price = specialPrice.trim();
    if (!name) {
      onToast("Name für Special eingeben");
      return;
    }
    const today = todayIsoDate();
    const { data, error } = await supabase
      .from("daily_push")
      .upsert(
        {
          restaurant_id: restaurantId,
          active_date: today,
          item_name: name,
          item_desc: price || null,
          item_emoji: "⭐",
        },
        { onConflict: "restaurant_id,active_date" },
      )
      .select("id, restaurant_id, active_date, item_emoji, item_name, item_desc")
      .single();
    if (error || !data) {
      onToast(error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    onDailyPushUpdated(data as DailyPush);
    onToast("✓ Tages-Special gesetzt");
  }

  async function removeSpecial() {
    const today = todayIsoDate();
    await supabase.from("daily_push").delete().eq("restaurant_id", restaurantId).eq("active_date", today);
    onDailyPushUpdated(null);
    setSpecialName("");
    setSpecialPrice("");
    onToast("Special entfernt");
  }

  function saveNotiz() {
    onSaveGuestNote();
  }

  const isBusyImport = importPhase === "reading" || importPhase === "analyzing";
  const menuIsEmpty = menuItems.length === 0;

  useEffect(() => {
    if (activeSub !== "menu") return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select(DASHBOARD_MENU_ITEM_SELECT)
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (cancelled || error || !data) return;
      onItemsChange(data as MenuItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSub, onItemsChange, restaurantId]);

  return (
    <div className={slideClass}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_UPLOAD}
        className="hidden"
        onChange={onFileInputChange}
      />

      <div
        className="px-5 pt-3.5"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="min-w-0" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => onSubChange("heute")}
            className="w-full transition active:scale-[0.99]"
            style={{
              background:
                activeSub === "heute" ? dash.ord : "rgba(232,80,2,0.08)",
              border:
                activeSub === "heute"
                  ? `1px solid ${dash.orm}`
                  : "1px solid rgba(232,80,2,0.25)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: dash.tx,
            }}
          >
            <span style={{ fontSize: 20 }} aria-hidden>
              ⭐
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Tages-Special</span>
          </button>
          <button
            type="button"
            onClick={() => onSubChange("notiz")}
            className="w-full transition active:scale-[0.99]"
            style={{
              backgroundColor: activeSub === "notiz" ? dash.ord : dash.s1,
              border:
                activeSub === "notiz" ? `1px solid ${dash.orm}` : `1px solid ${dash.bo}`,
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: dash.tx,
            }}
          >
            <span style={{ fontSize: 20 }} aria-hidden>
              📝
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Gäste-Notiz</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenPreview}
          className="shrink-0 self-stretch transition active:scale-95"
          style={{
            background: dash.s1,
            border: `1px solid ${dash.bo}`,
            borderRadius: 14,
            width: 72,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: 0.6,
          }}
        >
          <span style={{ fontSize: 22 }} aria-hidden>
            👁
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: dash.mu }}>Vorschau</span>
        </button>
      </div>

      {activeSub === "menu" && (
        <div className="animate-in fade-in duration-200">
          {importPhase === "review" && (
            <div className="mx-5 mt-3.5 flex flex-col pb-[20rem]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-[15px] font-bold" style={{ color: dash.gr }}>
                  ✅ {reviewRows.length} Gerichte erkannt
                </div>
                <button
                  type="button"
                  onClick={cancelReview}
                  className="shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                  style={{ borderColor: dash.bo, color: dash.mu }}
                >
                  Abbrechen
                </button>
              </div>
              <p className="mb-3 text-xs" style={{ color: dash.mu }}>
                Prüfe und bearbeite die Einträge. Nur ausgewählte Gerichte werden importiert.
              </p>
              {reviewRows.length > 0 && (
                <div
                  className="mb-4 flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  role="tablist"
                  aria-label="Hauptbereiche filtern (Import-Review)"
                >
                  {reviewMainTabs.map((k) => {
                    const isActive = activeMainTab === k;
                    const count =
                      k === "alle"
                        ? reviewRows.length
                        : reviewRows.filter((r) => normalizeEditorMainTab(r.main_tab) === k).length;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveMainTab(k)}
                        className="shrink-0 transition active:scale-[0.98]"
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          border: isActive
                            ? "1px solid rgba(232,80,2,0.3)"
                            : `1px solid ${dash.bo}`,
                          backgroundColor: isActive ? "rgba(232,80,2,0.1)" : "transparent",
                          color: isActive ? dash.or : dash.mu,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {editorMainTabChipLabel(k, count)}
                      </button>
                    );
                  })}
                </div>
              )}
              {groupedReview.map(([cat, rows]) => (
                <div key={cat} className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider" style={{ color: dash.or }}>
                    <span>{cat}</span>
                    <span style={{ color: dash.mu }}>
                      {categoryMap[normalizeCategoryKey(cat)] ?? "unklar"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {rows.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-[14px] border p-3"
                        style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) => updateReviewRow(r.id, { selected: e.target.checked })}
                            className="mt-1 h-4 w-4 shrink-0 rounded border"
                            style={{ accentColor: dash.or }}
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <input
                              value={r.name}
                              onChange={(e) => updateReviewRow(r.id, { name: e.target.value })}
                              className="w-full rounded-lg border px-2.5 py-1.5 text-sm font-semibold outline-none"
                              style={{
                                backgroundColor: dash.s2,
                                borderColor: dash.bo,
                                color: dash.tx,
                              }}
                              placeholder="Name"
                            />
                            <input
                              value={r.beschreibung}
                              onChange={(e) => updateReviewRow(r.id, { beschreibung: e.target.value })}
                              className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                              style={{
                                backgroundColor: dash.s2,
                                borderColor: dash.bo,
                                color: dash.mi,
                              }}
                              placeholder="Beschreibung"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={r.preis}
                                onChange={(e) =>
                                  updateReviewRow(r.id, {
                                    preis: Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full rounded-lg border px-2.5 py-1.5 text-sm font-bold outline-none"
                                style={{
                                  backgroundColor: dash.s2,
                                  borderColor: dash.bo,
                                  color: dash.or,
                                }}
                                placeholder="Preis"
                              />
                              <input
                                value={r.kategorie}
                                onChange={(e) => updateReviewRow(r.id, { kategorie: e.target.value })}
                                className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                                style={{
                                  backgroundColor: dash.s2,
                                  borderColor: dash.bo,
                                  color: dash.tx,
                                }}
                                placeholder="Kategorie"
                              />
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {portalReady &&
            importPhase === "review" &&
            activeSub === "menu" &&
            createPortal(
              <div
                className="pointer-events-auto fixed inset-x-0 bottom-0 z-[110] border-t px-5 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
                style={{
                  backgroundColor: dash.bg,
                  borderColor: "rgba(249,249,249,0.08)",
                  paddingBottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="mx-auto w-full max-w-[430px]">
                  {!menuIsEmpty && (
                    <div
                      className="mb-3 rounded-[16px] border p-3"
                      style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
                    >
                      <p
                        className="mb-1 text-center text-[13px] font-bold leading-snug"
                        style={{ color: dash.tx }}
                      >
                        Was soll mit deiner bestehenden Speisekarte passieren?
                      </p>
                      <p className="mb-3 text-center text-[11px] leading-snug" style={{ color: dash.mu }}>
                        Bitte eine Option antippen — ohne Auswahl kein Import.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImportMode("replace")}
                          disabled={submittingImport}
                          className="flex min-h-[108px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition active:scale-[0.98] disabled:opacity-50"
                          style={{
                            backgroundColor: importMode === "replace" ? dash.ord : dash.s2,
                            borderColor: importMode === "replace" ? dash.orm : dash.bo,
                            boxShadow:
                              importMode === "replace"
                                ? "0 4px 16px rgba(232,80,2,0.15)"
                                : undefined,
                          }}
                        >
                          <span className="text-xl leading-none">🔄</span>
                          <span className="text-[12px] font-extrabold" style={{ color: dash.or }}>
                            Ersetzen
                          </span>
                          <span className="text-[10px] leading-tight" style={{ color: dash.mu }}>
                            Alte löschen, nur neue behalten
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMode("add")}
                          disabled={submittingImport}
                          className="flex min-h-[108px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition active:scale-[0.98] disabled:opacity-50"
                          style={{
                            backgroundColor: importMode === "add" ? dash.ord : dash.s2,
                            borderColor: importMode === "add" ? dash.orm : dash.bo,
                            boxShadow:
                              importMode === "add"
                                ? "0 4px 16px rgba(232,80,2,0.15)"
                                : undefined,
                          }}
                        >
                          <span className="text-xl leading-none">➕</span>
                          <span className="text-[12px] font-extrabold" style={{ color: dash.or }}>
                            Hinzufügen
                          </span>
                          <span className="text-[10px] leading-tight" style={{ color: dash.mu }}>
                            Zu bestehenden hinzufügen
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={
                      submittingImport ||
                      selectedCount === 0 ||
                      (!menuIsEmpty && importMode === null)
                    }
                    onClick={() => void confirmImport()}
                    className="w-full rounded-[13px] py-3.5 text-[15px] font-bold shadow-lg transition-colors disabled:cursor-not-allowed"
                    style={
                      (menuIsEmpty || importMode !== null) &&
                      selectedCount > 0 &&
                      !submittingImport
                        ? {
                            background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
                            color: "#fff",
                            boxShadow: "0 6px 20px rgba(232,80,2,0.3)",
                            opacity: 1,
                          }
                        : {
                            backgroundColor: dash.s3,
                            color: dash.mu,
                            boxShadow: "none",
                            opacity: 0.85,
                          }
                    }
                  >
                    {submittingImport
                      ? "Importiert …"
                      : !menuIsEmpty && importMode === null
                        ? "Zuerst Ersetzen oder Hinzufügen wählen"
                        : `${selectedCount} ${selectedCount === 1 ? "Gericht" : "Gerichte"} importieren`}
                  </button>
                </div>
              </div>,
              document.body,
            )}

          {importPhase === "error" && (
            <div
              className="mx-5 mt-3.5 rounded-[20px] border px-5 py-5"
              style={{ backgroundColor: dash.s1, borderColor: "rgba(224,92,92,0.25)" }}
            >
              <div className="mb-2 text-[15px] font-bold" style={{ color: dash.re }}>
                Analyse fehlgeschlagen
              </div>
              <p className="mb-4 text-xs" style={{ color: dash.mu }}>
                {importError ?? "Unbekannter Fehler"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportPhase("idle");
                    setImportError(null);
                  }}
                  className="flex-1 rounded-[11px] border py-2.5 text-sm font-semibold"
                  style={{ borderColor: dash.bo, color: dash.mi }}
                >
                  Schließen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const f = lastFileRef.current;
                    if (f) void runImportFile(f);
                    else openFilePicker();
                  }}
                  className="flex-1 rounded-[11px] py-2.5 text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})` }}
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {portalReady &&
            showImportOverlay &&
            activeSub === "menu" &&
            createPortal(
              <div
                className="fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-sm"
                style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
                role="presentation"
              >
                <button
                  type="button"
                  className="absolute inset-0 cursor-default"
                  aria-label="Schließen"
                  onClick={() => closeImportOverlay()}
                />
                <div
                  className="relative z-10 max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] border-t px-5 pb-8 pt-4"
                  style={{
                    backgroundColor: dash.s1,
                    borderColor: dash.bo,
                    paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
                  }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="import-overlay-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="mx-auto mb-4 h-1 w-9 rounded-full"
                    style={{ backgroundColor: dash.s3 }}
                  />
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2
                      id="import-overlay-title"
                      className="text-lg font-extrabold tracking-tight"
                      style={{ color: dash.tx }}
                    >
                      Speisekarte importieren
                    </h2>
                    <button
                      type="button"
                      onClick={() => closeImportOverlay()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg leading-none"
                      style={{ borderColor: dash.bo, color: dash.mu, backgroundColor: dash.s2 }}
                      aria-label="Schließen"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => openPdfImportFromOverlay()}
                      className="w-full rounded-[14px] border px-4 py-4 text-left transition active:scale-[0.99]"
                      style={{ backgroundColor: dash.s2, borderColor: dash.bo }}
                    >
                      <div className="mb-1 text-base">📄</div>
                      <div className="text-[14px] font-bold" style={{ color: dash.tx }}>
                        PDF oder Foto
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: dash.mu }}>
                        Lade eine Datei hoch
                      </div>
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}

          {isBusyImport && (
            <div
              className="mx-5 mt-3.5 flex flex-col items-center gap-3 rounded-[20px] border px-5 py-6"
              style={{ backgroundColor: dash.s1, borderColor: dash.orm }}
            >
              <div
                className="h-12 w-12 animate-spin rounded-full border-[3px]"
                style={{ borderColor: dash.s2, borderTopColor: dash.or }}
              />
              <div className="text-center text-[15px] font-bold">
                {importPhase === "reading" ? "📄 Datei wird gelesen…" : "🔍 KI analysiert deine Speisekarte…"}
              </div>
              <div className="text-center text-xs" style={{ color: dash.mu }}>
                Bitte warten, das kann einige Sekunden dauern.
              </div>
            </div>
          )}

          {importPhase !== "review" && (
            <div className="mt-3.5 px-5">
              <div
                className="flex items-center justify-between"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, color: dash.or }}>qrave.menu/{slug}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowImportOverlay(true)}
                    className="flex items-center transition active:scale-[0.98]"
                    style={{
                      background: dash.s1,
                      border: `1px solid ${dash.bo}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: dash.mu,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    📥 Import
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCreateItem("Sonstiges")}
                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: dash.ord, borderColor: dash.orm, color: dash.or }}
                  >
                    + Gericht
                  </button>
                </div>
              </div>
              {menuItems.length > 0 && (
                <div
                  className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  role="tablist"
                  aria-label="Hauptbereiche filtern"
                >
                  {mainTabChips.map((k) => {
                    const isActive = activeMainTab === k;
                    const count =
                      k === "alle"
                        ? menuItems.length
                        : menuItems.filter((i) => normalizeEditorMainTab(i.main_tab) === k).length;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveMainTab(k)}
                        className="shrink-0 transition active:scale-[0.98]"
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          border: isActive
                            ? "1px solid rgba(232,80,2,0.3)"
                            : `1px solid ${dash.bo}`,
                          backgroundColor: isActive ? "rgba(232,80,2,0.1)" : "transparent",
                          color: isActive ? dash.or : dash.mu,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {editorMainTabChipLabel(k, count)}
                      </button>
                    );
                  })}
                </div>
              )}
              {editorCategoryNamesForList.map((cat) => {
                const items = groupedForList.find(([name]) => name === cat)?.[1] ?? [];
                const activeDrop = dragOverCategory === cat;
                return (
                  <div
                    key={cat}
                    data-editor-category={cat}
                    className="mb-3.5 rounded-xl p-1"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCategory(cat);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragItemId) void moveItemToCategory(dragItemId, cat);
                      setDragItemId(null);
                      setTouchDragItemId(null);
                      setDragOverCategory(null);
                    }}
                    style={{
                      border: `1px solid ${activeDrop ? dash.orm : "transparent"}`,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      {renamingCategory === cat ? (
                        <input
                          autoFocus
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onBlur={() => void renameCategory(cat, renamingValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void renameCategory(cat, renamingValue);
                            if (e.key === "Escape") setRenamingCategory(null);
                          }}
                          className="w-[70%] rounded-lg border px-2.5 py-1 text-sm font-bold outline-none"
                          style={{ backgroundColor: dash.s2, borderColor: dash.orm, color: dash.tx }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startRenameCategory(cat)}
                          className="text-left text-sm font-extrabold hover:opacity-80"
                        >
                          {cat}
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]" style={{ color: dash.mu }}>
                          {items.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenCreateItem(cat)}
                          className="rounded-md border px-2 py-0.5 text-[11px] font-bold"
                          style={{ borderColor: dash.orm, color: dash.or, backgroundColor: dash.ord }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((m) => (
                        <div
                          key={m.id}
                          className={`relative flex items-center gap-2 rounded-[14px] border px-3 py-3 transition ${!m.aktiv ? "opacity-45" : ""}`}
                          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={() => setDragItemId(m.id)}
                            onDragEnd={() => {
                              setDragItemId(null);
                              setDragOverCategory(null);
                            }}
                            onTouchStart={(e) => {
                              setTouchDragItemId(m.id);
                              handleItemSwipeStart(m.id, e.touches[0]?.clientX ?? 0);
                            }}
                            onTouchMove={(e) => {
                              const t = e.touches[0];
                              if (!t) return;
                              const el = document.elementFromPoint(t.clientX, t.clientY);
                              const catContainer = el?.closest("[data-editor-category]") as HTMLElement | null;
                              setDragOverCategory(catContainer?.dataset.editorCategory ?? null);
                              handleItemSwipeEnd(m.id, t.clientX);
                            }}
                            onTouchEnd={(e) => {
                              const t = e.changedTouches[0];
                              if (!t) return;
                              const el = document.elementFromPoint(t.clientX, t.clientY);
                              const catContainer = el?.closest("[data-editor-category]") as HTMLElement | null;
                              const dropCat = catContainer?.dataset.editorCategory;
                              if (dropCat && dropCat !== (m.kategorie || "Sonstiges")) {
                                void moveItemToCategory(m.id, dropCat);
                              }
                              setTouchDragItemId(null);
                              handleItemSwipeEnd(m.id, t.clientX);
                            }}
                            className="shrink-0 rounded p-1 text-lg leading-none"
                            style={{ color: dragItemId === m.id || touchDragItemId === m.id ? dash.or : dash.mu }}
                            aria-label="Verschieben"
                          >
                            ☰
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEdit(m)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div
                              className={`truncate text-sm font-semibold ${!m.aktiv ? "text-[rgba(249,249,249,0.38)] line-through" : ""}`}
                            >
                              {m.name}
                            </div>
                            {m.beschreibung && (
                              <div className="truncate text-[11px]" style={{ color: dash.mu }}>
                                {m.beschreibung}
                              </div>
                            )}
                          </button>
                          <span className="text-sm font-bold" style={{ color: m.aktiv ? dash.or : dash.mu }}>
                            {formatPreisEUR(m.preis)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void toggleAktiv(m)}
                            className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
                            style={{ backgroundColor: m.aktiv ? dash.or : dash.s3 }}
                            aria-label={m.aktiv ? "Deaktivieren" : "Aktivieren"}
                          >
                            <span
                              className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
                              style={{ left: m.aktiv ? "calc(100% - 19px)" : "3px" }}
                            />
                          </button>
                          {swipeOpenItemId === m.id && (
                            <button
                              type="button"
                              onClick={() => void deleteItem(m.id)}
                              className="ml-1 rounded-lg border px-2 py-1 text-[11px] font-bold"
                              style={{ borderColor: "rgba(224,92,92,.25)", color: dash.re, backgroundColor: "rgba(224,92,92,.08)" }}
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div
                          className="rounded-xl border border-dashed px-3 py-3 text-[11px] text-center"
                          style={{ borderColor: dash.bo, color: dash.mu }}
                        >
                          Keine Items — ziehe per Handle hierhin.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div data-editor-category="" />
              <div className="mb-4">
                {!showNewCategoryInput ? (
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryInput(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[13px] border border-dashed py-3 text-[13px] font-semibold"
                    style={{
                      backgroundColor: dash.s1,
                      borderColor: "rgba(232,80,2,0.3)",
                      color: dash.or,
                    }}
                  >
                    + Neue Kategorie
                  </button>
                ) : (
                  <input
                    autoFocus
                    value={draftNewCategory}
                    onChange={(e) => setDraftNewCategory(e.target.value)}
                    onBlur={() => {
                      const v = draftNewCategory.trim();
                      if (v) setExtraCategories((prev) => (prev.includes(v) ? prev : [...prev, v]));
                      setDraftNewCategory("");
                      setShowNewCategoryInput(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = draftNewCategory.trim();
                        if (v) setExtraCategories((prev) => (prev.includes(v) ? prev : [...prev, v]));
                        setDraftNewCategory("");
                        setShowNewCategoryInput(false);
                      }
                      if (e.key === "Escape") {
                        setDraftNewCategory("");
                        setShowNewCategoryInput(false);
                      }
                    }}
                    className="w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                    style={{ backgroundColor: dash.s2, borderColor: dash.orm, color: dash.tx }}
                    placeholder="Kategoriename eingeben …"
                  />
                )}
              </div>

              <div className="mt-6 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <button
                  type="button"
                  onClick={() => setDeleteMenuConfirmOpen(true)}
                  className="w-full rounded-[11px] border py-2.5 text-[12px] font-medium transition active:opacity-80"
                  style={{
                    borderColor: dash.bo,
                    color: "rgba(249,249,249,0.42)",
                    backgroundColor: "transparent",
                  }}
                >
                  Karte löschen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {portalReady &&
        activeSub === "menu" &&
        deleteMenuConfirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center px-5 backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Schließen"
              onClick={() => !deletingMenu && setDeleteMenuConfirmOpen(false)}
            />
            <div
              className="relative z-10 w-full max-w-[340px] rounded-[20px] border px-5 py-5 shadow-xl"
              style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-menu-title"
            >
              <h2 id="delete-menu-title" className="mb-2 text-[17px] font-extrabold tracking-tight">
                Speisekarte löschen?
              </h2>
              <p className="mb-5 text-[13px] leading-relaxed" style={{ color: dash.mi }}>
                Alle Kategorien und Gerichte werden unwiderruflich gelöscht. Diese Aktion kann nicht
                rückgängig gemacht werden.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deletingMenu}
                  onClick={() => setDeleteMenuConfirmOpen(false)}
                  className="flex-1 rounded-[12px] border py-3 text-[14px] font-semibold transition disabled:opacity-50"
                  style={{ borderColor: dash.bo, color: dash.mi, backgroundColor: dash.s2 }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={deletingMenu}
                  onClick={() => void confirmDeleteFullMenu()}
                  className="flex-1 rounded-[12px] py-3 text-[14px] font-bold text-white transition disabled:opacity-60"
                  style={{
                    backgroundColor: dash.re,
                    boxShadow: "0 4px 14px rgba(224,92,92,0.25)",
                  }}
                >
                  {deletingMenu ? "Löscht …" : "Alles löschen"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {activeSub === "heute" && (
        <div className="px-5 pt-3.5 animate-in fade-in duration-200">
          {!dailyPush ? (
            <div
              className="rounded-[20px] border px-5 py-5"
              style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
            >
              <div className="mb-0.5 text-base font-extrabold">Tages-Special</div>
              <div className="mb-3.5 text-xs" style={{ color: dash.mu }}>
                Wird oben in der Speisekarte angezeigt
              </div>
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDailyForm({ ...dailyForm, mode: "select" })}
                  className="flex-1 rounded-full border py-1.5 text-xs font-semibold"
                  style={
                    dailyForm.mode === "select"
                      ? { backgroundColor: dash.or, borderColor: dash.or, color: "#fff" }
                      : { borderColor: dash.bo, color: dash.mu }
                  }
                >
                  Aus Karte
                </button>
                <button
                  type="button"
                  onClick={() => setDailyForm({ ...dailyForm, mode: "manual" })}
                  className="flex-1 rounded-full border py-1.5 text-xs font-semibold"
                  style={
                    dailyForm.mode === "manual"
                      ? { backgroundColor: dash.or, borderColor: dash.or, color: "#fff" }
                      : { borderColor: dash.bo, color: dash.mu }
                  }
                >
                  Manuell
                </button>
              </div>
              {dailyForm.mode === "select" ? (
                <select
                  className="mb-2.5 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                  style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                  value={dailyForm.itemId ?? ""}
                  onChange={(e) =>
                    setDailyForm({ ...dailyForm, itemId: e.target.value || null })
                  }
                >
                  <option value="">Gericht wählen …</option>
                  {menuItems.filter((x) => x.aktiv).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    className="mb-2.5 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                    style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                    placeholder="Emoji"
                    value={dailyForm.emoji}
                    onChange={(e) => setDailyForm({ ...dailyForm, emoji: e.target.value })}
                  />
                  <input
                    className="mb-2.5 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                    style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                    placeholder="Name"
                    value={dailyForm.name}
                    onChange={(e) => setDailyForm({ ...dailyForm, name: e.target.value })}
                  />
                  <textarea
                    className="mb-2.5 w-full resize-none rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                    style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                    rows={2}
                    placeholder="Beschreibung"
                    value={dailyForm.desc}
                    onChange={(e) => setDailyForm({ ...dailyForm, desc: e.target.value })}
                  />
                </>
              )}
              {dailyError && <p className="mb-2 text-xs" style={{ color: dash.re }}>{dailyError}</p>}
              <button
                type="button"
                disabled={savingDaily}
                onClick={() => void onSaveDaily()}
                className="w-full rounded-[11px] py-3.5 text-sm font-bold text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
                  boxShadow: "0 6px 20px rgba(232,80,2,0.25)",
                }}
              >
                {savingDaily ? "Speichert …" : "Special setzen (Speisekarten-Flow)"}
              </button>
              <p className="mt-2 text-[10px]" style={{ color: dash.mu }}>
                Oder kurz Name + Preis unten (Banner-Text).
              </p>
              <input
                className="mt-2 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                placeholder="Name (Kurzform)"
                value={specialName}
                onChange={(e) => setSpecialName(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-[11px] border px-3.5 py-3 text-sm outline-none"
                style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                placeholder="Preis (z. B. 38,50 €)"
                value={specialPrice}
                onChange={(e) => setSpecialPrice(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void setSpecialFromForm()}
                className="mt-2 w-full rounded-[11px] py-3 text-sm font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})` }}
              >
                Special setzen
              </button>
            </div>
          ) : (
            <div
              className="flex items-center justify-between rounded-2xl border px-4 py-4"
              style={{ backgroundColor: dash.ord, borderColor: dash.orm }}
            >
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: dash.or }}>
                  Aktiv heute
                </div>
                <div className="text-[17px] font-extrabold">
                  {dailyPush.item_emoji} {dailyPush.item_name}
                </div>
                {dailyPush.item_desc && (
                  <div className="mt-0.5 text-xs" style={{ color: dash.mi }}>
                    {dailyPush.item_desc}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void removeSpecial()}
                className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
                style={{
                  backgroundColor: "rgba(232,80,2,0.15)",
                  borderColor: dash.orm,
                  color: dash.or,
                }}
              >
                Entfernen
              </button>
            </div>
          )}
        </div>
      )}

      {activeSub === "notiz" && (
        <div
          className="mx-5 mt-3.5 rounded-2xl border px-4 py-4 animate-in fade-in duration-200"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <div className="mb-0.5 text-base font-extrabold">Gäste-Notiz</div>
          <div className="mb-3 text-xs" style={{ color: dash.mu }}>
            Erscheint in der Vorschau (lokal gespeichert)
          </div>
          <textarea
            className="mb-3 w-full resize-none rounded-[11px] border px-3.5 py-3 text-sm outline-none"
            style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
            rows={4}
            placeholder="z. B. Küche heute bis 22 Uhr"
            value={guestNotiz}
            onChange={(e) => onGuestNotizChange(e.target.value)}
          />
          <button
            type="button"
            onClick={saveNotiz}
            className="w-full rounded-[11px] py-3.5 text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})` }}
          >
            Notiz speichern
          </button>
        </div>
      )}
    </div>
  );
}
