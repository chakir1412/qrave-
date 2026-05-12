import Link from "next/link";
import type { PublicRestaurant } from "@/lib/load-restaurant-public";

type Props = {
  restaurant: PublicRestaurant;
};

function buildWhatsappUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}`;
}

function buildInstagramUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@/, "");
  return `https://instagram.com/${handle}`;
}

export default function ContactPage({ restaurant }: Props) {
  const accent = restaurant.accent_color?.trim() || "#C8894E";
  const whatsapp = buildWhatsappUrl(restaurant.whatsapp);
  const instagram = buildInstagramUrl(restaurant.instagram);
  const phone = restaurant.telefon?.trim() ?? "";
  const phoneHref = phone ? `tel:${phone.replace(/\s/g, "")}` : null;
  const mapsExternal = restaurant.maps_url?.trim() ?? null;

  return (
    <div
      className="min-h-dvh"
      style={{ background: "#0e0c0a", color: "#fff" }}
    >
      <div className="mx-auto w-full max-w-md px-5 pb-12 pt-6">
        {/* Header mit Back */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            href={`/${restaurant.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ← Zurück
          </Link>
          <Link
            href={`/${restaurant.slug}/karte`}
            className="text-xs font-semibold underline-offset-4 hover:underline"
            style={{ color: accent }}
          >
            Zur Speisekarte
          </Link>
        </header>

        <h1
          className="font-serif text-[2.1rem] font-light leading-tight tracking-tight"
        >
          {restaurant.name}
        </h1>
        {restaurant.adresse?.trim() ? (
          <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
            {restaurant.adresse}
          </p>
        ) : null}

        {/* Direktlinks */}
        <div className="mt-6 flex flex-col gap-2.5">
          {phoneHref ? (
            <ContactRow
              href={phoneHref}
              label="Anrufen"
              value={phone}
              accent={accent}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
          ) : null}
          {whatsapp ? (
            <ContactRow
              href={whatsapp}
              label="WhatsApp"
              value={restaurant.whatsapp ?? ""}
              external
              accent={accent}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.2-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1s-1.2-.4-2.3-1.4c-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5l.3-.4c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2 0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.6 4.1.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4 0-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.9L2 22l5.3-1.3c1.4.7 3 1.1 4.7 1.1 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
                </svg>
              }
            />
          ) : null}
          {instagram ? (
            <ContactRow
              href={instagram}
              label="Instagram"
              value={(restaurant.instagram ?? "").replace(/^@/, "")}
              external
              accent={accent}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              }
            />
          ) : null}
          {mapsExternal ? (
            <ContactRow
              href={mapsExternal}
              label="In Google Maps öffnen"
              value={restaurant.adresse?.trim() ?? "Anfahrt"}
              external
              accent={accent}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  href,
  label,
  value,
  icon,
  accent,
  external = false,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors active:bg-white/[0.04]"
      style={{
        borderColor: "rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ background: `${accent}22`, color: accent }}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span className="truncate text-sm font-semibold text-white">{value}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} aria-hidden>
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
