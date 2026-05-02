"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { FounderTodoRow } from "@/lib/founder-types";

type Props = {
  todos: FounderTodoRow[];
  isMobile: boolean;
  onRefresh: () => Promise<void>;
};

type TodoStatus = "todo" | "in_progress" | "done";
type TodoPriority = "high" | "medium" | "low";

type TodoKanbanItem = {
  id: string;
  text: string;
  created_at: string;
  done: boolean;
  status: TodoStatus;
  notes: string;
  due_date: string | null;
  priority: TodoPriority;
};

type DetailDraft = {
  id: string;
  text: string;
  status: TodoStatus;
  notes: string;
  due_date: string | null;
  priority: TodoPriority;
  created_at: string;
};

type AddDraft = {
  text: string;
  description: string;
  priority: TodoPriority;
  due_date: string;
  status: TodoStatus;
};

const COLS: Array<{ key: TodoStatus; title: string; accent: string }> = [
  { key: "todo", title: "Zu erledigen", accent: "#ffd426" },
  { key: "in_progress", title: "In Arbeit", accent: "#5b9bff" },
  { key: "done", title: "Erledigt", accent: "#00c8a0" },
];

function normalizeStatus(x: unknown, done: boolean): TodoStatus {
  if (x === "todo" || x === "in_progress" || x === "done") return x;
  return done ? "done" : "todo";
}

function normalizePriority(priority: unknown): TodoPriority {
  if (priority === "high" || priority === "medium" || priority === "low") return priority;
  return "medium";
}

function priorityColor(priority: TodoPriority): string {
  if (priority === "high") return "#ff4b6e";
  if (priority === "low") return "#34e89e";
  return "#ffd426";
}

function statusLabel(status: TodoStatus): string {
  if (status === "in_progress") return "In Arbeit";
  if (status === "done") return "Erledigt";
  return "Zu erledigen";
}

function formatCreated(ts: string): string {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function baseInputStyle() {
  return {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    color: "#fff",
    outline: "none",
    boxSizing: "border-box" as const,
  };
}

export function TodoTab({ isMobile, onRefresh }: Props) {
  const [items, setItems] = useState<TodoKanbanItem[]>([]);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TodoStatus | null>(null);
  const suppressCardClickRef = useRef(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailDraft | null>(null);
  const [savedBadge, setSavedBadge] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>({
    text: "",
    description: "",
    priority: "medium",
    due_date: "",
    status: "todo",
  });

  async function loadTodos(): Promise<void> {
    const { data, error } = await supabase
      .from("todos")
      .select("id,text,done,created_at,status,notes,description,due_date,priority")
      .order("created_at", { ascending: false });
    if (error) return;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setItems(
      rows.map((r) => {
        const notes = typeof r.notes === "string" ? r.notes : "";
        const description = typeof r.description === "string" ? r.description : "";
        return {
          id: String(r.id ?? ""),
          text: String(r.text ?? ""),
          done: Boolean(r.done),
          created_at: String(r.created_at ?? new Date().toISOString()),
          status: normalizeStatus(r.status, Boolean(r.done)),
          notes: notes || description,
          due_date: typeof r.due_date === "string" ? r.due_date : null,
          priority: normalizePriority(r.priority),
        };
      }),
    );
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void loadTodos();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const grouped = useMemo(
    () => ({
      todo: items.filter((i) => i.status === "todo"),
      in_progress: items.filter((i) => i.status === "in_progress"),
      done: items.filter((i) => i.status === "done"),
    }),
    [items],
  );

  useEffect(() => {
    if (!detail) return;
    const timer = window.setTimeout(() => {
      void supabase
        .from("todos")
        .update({
          text: detail.text,
          notes: detail.notes || null,
          description: detail.notes || null,
          priority: detail.priority,
          due_date: detail.due_date || null,
          status: detail.status,
          done: detail.status === "done",
        })
        .eq("id", detail.id)
        .then(({ error }) => {
          if (error) {
            console.error("Todo UPDATE Fehler:", error);
            return;
          }
          setItems((prev) =>
            prev.map((x) =>
              x.id === detail.id
                ? {
                    ...x,
                    text: detail.text,
                    status: detail.status,
                    done: detail.status === "done",
                    notes: detail.notes,
                    due_date: detail.due_date,
                    priority: detail.priority,
                  }
                : x,
            ),
          );
          setSavedBadge(true);
          window.setTimeout(() => setSavedBadge(false), 2000);
        });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [detail]);

  function handleColumnDragLeave(e: DragEvent<HTMLElement>, colKey: TodoStatus): void {
    const related = e.relatedTarget;
    if (related instanceof Node && e.currentTarget.contains(related)) return;
    setDragOverColumn((cur) => (cur === colKey ? null : cur));
  }

  async function handleColumnDrop(e: DragEvent<HTMLElement>, toStatus: TodoStatus): Promise<void> {
    e.preventDefault();
    setDragOverColumn(null);
    const todoId = e.dataTransfer.getData("todoId");
    const fromStatusRaw = e.dataTransfer.getData("fromStatus");
    if (!todoId || (fromStatusRaw !== "todo" && fromStatusRaw !== "in_progress" && fromStatusRaw !== "done")) {
      return;
    }
    const fromStatus = fromStatusRaw as TodoStatus;
    if (fromStatus === toStatus) return;

    setItems((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, status: toStatus, done: toStatus === "done" } : t)),
    );

    const { error } = await supabase
      .from("todos")
      .update({ status: toStatus, done: toStatus === "done" })
      .eq("id", todoId);

    if (error) {
      console.error("Drag & Drop UPDATE Fehler:", error);
      setItems((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, status: fromStatus, done: fromStatus === "done" } : t)),
      );
      return;
    }

    setDetail((prev) => (prev && prev.id === todoId ? { ...prev, status: toStatus } : prev));
    void onRefresh();
  }

  async function move(item: TodoKanbanItem, status: TodoStatus): Promise<void> {
    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, status, done: status === "done" } : x)),
    );
    const { error } = await supabase
      .from("todos")
      .update({ status, done: status === "done" })
      .eq("id", item.id);
    if (error) await loadTodos();
    await onRefresh();
  }

  async function remove(id: string): Promise<void> {
    setPending(true);
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) await loadTodos();
    if (detail?.id === id) setDetail(null);
    setPending(false);
    await onRefresh();
  }

  async function createTask(): Promise<void> {
    if (!addDraft.text.trim()) return;
    setSaveError(null);
    setPending(true);
    const title = addDraft.text.trim();
    const description = addDraft.description.trim();
    const priority = addDraft.priority;
    const dueDate = addDraft.due_date || null;
    const status = addDraft.status;
    const { data, error } = await supabase
      .from("todos")
      .insert({
        text: title,
        description: description || null,
        notes: description || null,
        priority,
        due_date: dueDate,
        status,
        done: status === "done",
      })
      .select("id,text,created_at,done,status,notes,description,due_date,priority")
      .single();
    if (error) {
      console.error("Todos INSERT Fehler:", error);
      setSaveError(`Fehler beim Speichern: ${error.message}`);
      setPending(false);
      return;
    }
    const rec = data as Record<string, unknown>;
    const notes = typeof rec.notes === "string" ? rec.notes : "";
    const recDescription = typeof rec.description === "string" ? rec.description : "";
    setItems((prev) => [
      {
        id: String(rec.id ?? ""),
        text: String(rec.text ?? ""),
        created_at: String(rec.created_at ?? new Date().toISOString()),
        done: Boolean(rec.done),
        status: normalizeStatus(rec.status, Boolean(rec.done)),
        notes: notes || recDescription,
        due_date: typeof rec.due_date === "string" ? rec.due_date : null,
        priority: normalizePriority(rec.priority),
      },
      ...prev,
    ]);
    setPending(false);
    setAddModalOpen(false);
    setAddDraft({
      text: "",
      description: "",
      priority: "medium",
      due_date: "",
      status: "todo",
    });
    void onRefresh();
  }

  function openDetail(item: TodoKanbanItem): void {
    setDetail({
      id: item.id,
      text: item.text,
      status: item.status,
      notes: item.notes,
      due_date: item.due_date,
      priority: item.priority,
      created_at: item.created_at,
    });
  }

  function openAddModal(status: TodoStatus): void {
    setAddDraft({
      text: "",
      description: "",
      priority: "medium",
      due_date: "",
      status,
    });
    setAddModalOpen(true);
  }

  const commonInput = baseInputStyle();

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        {COLS.map((col) => {
          const arr = grouped[col.key];
          const columnActive = dragOverColumn === col.key;
          return (
            <section
              key={col.key}
              className="founder-card"
              style={{
                padding: 12,
                minHeight: 360,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: columnActive ? "1px solid rgba(255,255,255,0.2)" : undefined,
                background: columnActive ? "rgba(255,255,255,0.05)" : undefined,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverColumn(col.key);
              }}
              onDragEnter={() => setDragOverColumn(col.key)}
              onDragLeave={(e) => handleColumnDragLeave(e, col.key)}
              onDrop={(e) => void handleColumnDrop(e, col.key)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{col.title}</h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0c0c0f",
                    background: col.accent,
                    borderRadius: 999,
                    padding: "3px 8px",
                  }}
                >
                  {arr.length}
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {arr.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("todoId", t.id);
                      e.dataTransfer.setData("fromStatus", t.status);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingTodoId(t.id);
                    }}
                    onDragEnd={() => {
                      setDraggingTodoId(null);
                      setDragOverColumn(null);
                      suppressCardClickRef.current = true;
                      window.setTimeout(() => {
                        suppressCardClickRef.current = false;
                      }, 150);
                    }}
                    onClick={() => {
                      if (suppressCardClickRef.current) return;
                      openDetail(t);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.06)",
                      padding: 10,
                      opacity:
                        draggingTodoId === t.id ? 0.4 : t.status === "done" ? 0.45 : 1,
                      cursor: draggingTodoId === t.id ? "grabbing" : "grab",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: t.status === "done" ? "line-through" : "none",
                          }}
                        >
                          {t.text}
                        </p>
                        {t.notes ? (
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: 11,
                              color: "rgba(255,255,255,0.45)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.notes.slice(0, 60)}
                          </p>
                        ) : null}
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                          {new Date(t.created_at).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId((p) => (p === t.id ? null : t.id));
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                        }}
                        aria-label="Menü"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>

                    {menuId === t.id ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {t.status !== "todo" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void move(t, t.status === "done" ? "in_progress" : "todo");
                            }}
                            style={miniBtn("rgba(255,255,255,0.08)")}
                          >
                            ← Zurück
                          </button>
                        ) : null}
                        {t.status !== "in_progress" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void move(t, "in_progress");
                            }}
                            style={miniBtn("rgba(91,155,255,0.18)")}
                          >
                            → In Arbeit
                          </button>
                        ) : null}
                        {t.status !== "done" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void move(t, "done");
                            }}
                            style={miniBtn("rgba(0,200,160,0.18)")}
                          >
                            → Erledigt
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(t.id);
                          }}
                          disabled={pending}
                          style={miniBtn("rgba(255,75,110,0.18)")}
                        >
                          Löschen
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <button
                type="button"
                onClick={() => openAddModal(col.key)}
                style={{
                  marginTop: "auto",
                  border: "1px dashed rgba(255,255,255,0.28)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.8)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                + Task hinzufügen
              </button>
            </section>
          );
        })}
      </div>

      {addModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
        >
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setAddModalOpen(false)}
            style={{ position: "absolute", inset: 0, border: "none", background: "transparent" }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 520,
              maxHeight: "92vh",
              overflow: "auto",
              background: "#0f0f1a",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Task erstellen</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            {saveError ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#ff4b6e" }}>{saveError}</p>
            ) : null}

            <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Titel*
              <input
                value={addDraft.text}
                onChange={(e) => setAddDraft((p) => ({ ...p, text: e.target.value }))}
                style={{ ...commonInput, marginTop: 6, padding: "10px 12px", fontSize: 16, fontWeight: 600 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Beschreibung
              <textarea
                rows={3}
                value={addDraft.description}
                onChange={(e) => setAddDraft((p) => ({ ...p, description: e.target.value }))}
                style={{ ...commonInput, marginTop: 6, padding: "10px 12px", resize: "vertical" }}
              />
            </label>

            <p style={{ margin: "12px 0 6px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Priorität</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "high" as const, label: "🔴 Hoch", color: "#ff4b6e" },
                { key: "medium" as const, label: "🟡 Mittel", color: "#ffd426" },
                { key: "low" as const, label: "🟢 Niedrig", color: "#34e89e" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setAddDraft((x) => ({ ...x, priority: p.key }))}
                  style={{
                    border: `1px solid ${addDraft.priority === p.key ? p.color : "rgba(255,255,255,0.14)"}`,
                    background: addDraft.priority === p.key ? `${p.color}22` : "transparent",
                    color: addDraft.priority === p.key ? p.color : "rgba(255,255,255,0.8)",
                    borderRadius: 8,
                    padding: "7px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Fälligkeitsdatum
              <input
                type="date"
                value={addDraft.due_date}
                onChange={(e) => setAddDraft((p) => ({ ...p, due_date: e.target.value }))}
                style={{ ...commonInput, marginTop: 6, padding: "9px 10px" }}
              />
            </label>

            <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Spalte
              <select
                value={addDraft.status}
                onChange={(e) => setAddDraft((p) => ({ ...p, status: e.target.value as TodoStatus }))}
                style={{ ...commonInput, marginTop: 6, padding: "9px 10px" }}
              >
                <option value="todo">Zu erledigen</option>
                <option value="in_progress">In Arbeit</option>
                <option value="done">Erledigt</option>
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => void createTask()}
                disabled={pending || !addDraft.text.trim()}
                style={{
                  border: "none",
                  background: "#00c8a0",
                  color: "#000",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: pending || !addDraft.text.trim() ? 0.6 : 1,
                  cursor: pending || !addDraft.text.trim() ? "not-allowed" : "pointer",
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <>
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setDetail(null)}
            style={{
              position: "fixed",
              inset: 0,
              border: "none",
              background: "rgba(0,0,0,0.4)",
              zIndex: 80,
              cursor: "pointer",
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: isMobile ? "100%" : 480,
              height: "100vh",
              zIndex: 81,
              background: "#0f0f1a",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              padding: "20px 18px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{savedBadge ? "Gespeichert ✓" : ""}</span>
              <button
                type="button"
                onClick={() => setDetail(null)}
                style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer" }}
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>

            <input
              value={detail.text}
              onChange={(e) => setDetail((p) => (p ? { ...p, text: e.target.value } : p))}
              style={{
                ...commonInput,
                fontSize: 22,
                fontWeight: 700,
                padding: "10px 12px",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setDetail((p) => {
                  if (!p) return p;
                  const next: TodoStatus =
                    p.status === "todo" ? "in_progress" : p.status === "in_progress" ? "done" : "todo";
                  return { ...p, status: next };
                })
              }
              style={{
                alignSelf: "flex-start",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {statusLabel(detail.status)}
            </button>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Priorität</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {[
                    { key: "high" as const, label: "🔴 Hoch", color: "#ff4b6e" },
                    { key: "medium" as const, label: "🟡 Mittel", color: "#ffd426" },
                    { key: "low" as const, label: "🟢 Niedrig", color: "#34e89e" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setDetail((prev) => (prev ? { ...prev, priority: p.key } : prev))}
                      style={{
                        border: `1px solid ${detail.priority === p.key ? p.color : "rgba(255,255,255,0.14)"}`,
                        background: detail.priority === p.key ? `${p.color}22` : "transparent",
                        color: detail.priority === p.key ? p.color : "rgba(255,255,255,0.8)",
                        borderRadius: 8,
                        padding: "6px 9px",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Fälligkeitsdatum</label>
                <input
                  type="date"
                  value={detail.due_date ?? ""}
                  onChange={(e) => setDetail((p) => (p ? { ...p, due_date: e.target.value || null } : p))}
                  style={{ ...commonInput, marginTop: 6, padding: "9px 10px" }}
                />
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Notizen</label>
              <textarea
                value={detail.notes}
                onChange={(e) => setDetail((p) => (p ? { ...p, notes: e.target.value } : p))}
                style={{
                  ...commonInput,
                  minHeight: 200,
                  flex: 1,
                  resize: "vertical",
                  padding: "10px 12px",
                }}
              />
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                Erstellt am: {formatCreated(detail.created_at)}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button
                type="button"
                onClick={() => void remove(detail.id)}
                style={{
                  border: "none",
                  background: "rgba(255,75,110,0.16)",
                  color: "#ff4b6e",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Löschen
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

function miniBtn(bg: string): CSSProperties {
  return {
    border: "none",
    background: bg,
    color: "#fff",
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: 11,
    cursor: "pointer",
  };
}

