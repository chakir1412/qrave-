import Link from "next/link";
import type { PublicRestaurant } from "@/lib/load-restaurant-public";
import { AnimatedBackLink } from "./AnimatedBackLink";

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
          <AnimatedBackLink
            href={`/${restaurant.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ← Zurück
          </AnimatedBackLink>
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
              iconClass="fa-solid fa-phone"
            />
          ) : null}
          {whatsapp ? (
            <ContactRow
              href={whatsapp}
              label="WhatsApp"
              value={restaurant.whatsapp ?? ""}
              external
              accent={accent}
              iconClass="fa-brands fa-whatsapp"
            />
          ) : null}
          {instagram ? (
            <ContactRow
              href={instagram}
              label="Instagram"
              value={(restaurant.instagram ?? "").replace(/^@/, "")}
              external
              accent={accent}
              iconClass="fa-brands fa-instagram"
            />
          ) : null}
          {mapsExternal ? (
            <ContactRow
              href={mapsExternal}
              label="In Google Maps öffnen"
              value={restaurant.adresse?.trim() ?? "Anfahrt"}
              external
              accent={accent}
              iconClass="fa-solid fa-location-dot"
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
  iconClass,
  accent,
  external = false,
}: {
  href: string;
  label: string;
  value: string;
  iconClass: string;
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
        <i className={`${iconClass} text-[16px]`} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span className="truncate text-sm font-semibold text-white">{value}</span>
      </span>
      <i
        className="fa-solid fa-chevron-right text-[11px]"
        style={{ color: "rgba(255,255,255,0.35)" }}
        aria-hidden
      />
    </a>
  );
}
