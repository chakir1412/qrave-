"use client";

type GuestNoteBannerProps = {
  note: string;
  /** Optional: dunkles Theme, sonst Light. */
  theme?: "light" | "dark";
};

/** Auffälliger Banner für `restaurants.guest_note`, gleiches visuelles Gewicht
 *  wie `DailyPushBanner` (Tages-Special) — größere Padding, Serif-Headline. */
export default function GuestNoteBanner({ note, theme = "light" }: GuestNoteBannerProps) {
  const trimmed = note.trim();
  if (!trimmed) return null;

  if (theme === "dark") {
    return (
      <div
        role="note"
        className="mb-6 flex items-center gap-3 rounded-2xl border p-4"
        style={{
          borderColor: "rgba(184,150,106,0.25)",
          background:
            "linear-gradient(135deg, rgba(184,150,106,0.18), rgba(15,13,10,0.95))",
        }}
      >
        <span aria-hidden style={{ fontSize: "2.2rem", lineHeight: 1 }}>
          ✨
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="mb-0.5 text-[0.58rem] font-semibold uppercase tracking-widest"
            style={{ color: "#C8894E" }}
          >
            Hinweis für Gäste
          </div>
          <div
            className="font-serif text-[1.05rem] leading-snug"
            style={{ color: "#F0EBE3", fontWeight: 400 }}
          >
            {trimmed}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="note"
      className="mb-6 flex items-center gap-3 rounded-2xl border p-4"
      style={{
        borderColor: "rgba(184,150,106,0.25)",
        background:
          "linear-gradient(135deg, rgba(184,150,106,0.12), rgba(255,255,255,0.7))",
      }}
    >
      <span aria-hidden style={{ fontSize: "2.2rem", lineHeight: 1 }}>
        ✨
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="mb-0.5 text-[0.58rem] font-semibold uppercase tracking-widest"
          style={{ color: "#b8966a" }}
        >
          Hinweis für Gäste
        </div>
        <div
          className="font-serif text-[1.05rem] leading-snug"
          style={{ color: "#1a1916", fontWeight: 400 }}
        >
          {trimmed}
        </div>
      </div>
    </div>
  );
}
