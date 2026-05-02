"use client";

type GuestNoteBannerProps = {
  note: string;
  /** Optional: dunkles Theme (z. B. BarSoleil), sonst Light. */
  theme?: "light" | "dark";
};

/** Dezenter Banner für `restaurants.guest_note`, Stil orientiert sich am Tages-Special-Banner. */
export default function GuestNoteBanner({ note, theme = "light" }: GuestNoteBannerProps) {
  const trimmed = note.trim();
  if (!trimmed) return null;

  if (theme === "dark") {
    return (
      <div
        role="note"
        className="mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3"
        style={{
          borderColor: "rgba(184,150,106,0.25)",
          background: "linear-gradient(135deg, rgba(184,150,106,0.12), rgba(15,13,10,0.85))",
          color: "#F0EBE3",
        }}
      >
        <span aria-hidden style={{ fontSize: "1.4rem" }}>
          ✨
        </span>
        <div className="min-w-0 text-[0.78rem] leading-snug" style={{ color: "#F0EBE3" }}>
          {trimmed}
        </div>
      </div>
    );
  }

  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3"
      style={{
        borderColor: "rgba(184,150,106,0.25)",
        background: "linear-gradient(135deg, rgba(184,150,106,0.08), rgba(255,255,255,0.6))",
        color: "#1a1916",
      }}
    >
      <span aria-hidden style={{ fontSize: "1.4rem" }}>
        ✨
      </span>
      <div className="min-w-0 text-[0.82rem] leading-snug">{trimmed}</div>
    </div>
  );
}
