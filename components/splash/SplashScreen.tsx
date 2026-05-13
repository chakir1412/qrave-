import Link from "next/link";
import type { PublicRestaurant } from "@/lib/load-restaurant-public";
import { getOpenStatus } from "@/lib/oeffnungszeiten";
import ShareButton from "./ShareButton";
import { LanguageButton } from "./LanguageButton";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";

type Props = {
  restaurant: PublicRestaurant;
};

/** Splash-Seite für die Gäste-Speisekarte (qrave.menu/[slug]).
 *  Server-rendered, kein JS-State. Akzentfarbe aus restaurant.accent_color
 *  oder Fallback Kupfer. */
export default function SplashScreen({ restaurant }: Props) {
  const accent = restaurant.accent_color?.trim() || "#C8894E";
  const mediaUrl = restaurant.splash_media_url?.trim() ?? "";
  const mediaType = restaurant.splash_media_type === "video" ? "video" : "image";
  const legacyImageUrl =
    mediaUrl.length === 0
      ? restaurant.splash_image_url?.trim() || restaurant.logo_url?.trim() || ""
      : "";
  const status = getOpenStatus(restaurant.oeffnungszeiten ?? null);

  const statusBadge = (() => {
    if (status.kind === "open") {
      return { dot: "#34e89e", text: "#fff", bg: "rgba(52,232,158,0.12)", border: "rgba(52,232,158,0.4)", label: `Geöffnet · bis ${status.closesAt}` };
    }
    if (status.kind === "opens-later") {
      return { dot: "#ffd426", text: "#fff", bg: "rgba(255,212,38,0.12)", border: "rgba(255,212,38,0.4)", label: `Geschlossen · öffnet um ${status.opensAt}` };
    }
    if (status.kind === "closed-today") {
      return { dot: "#ff4b6e", text: "#fff", bg: "rgba(255,75,110,0.12)", border: "rgba(255,75,110,0.4)", label: "Heute geschlossen" };
    }
    return null;
  })();

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden"
      style={{ background: "#0e0c0a", color: "#fff" }}
    >
      {/* Foto- oder Video-Hintergrund (Cover) + einheitliches dunkles Overlay
          rgba(0,0,0,0.45). Fallback: Legacy splash_image_url/logo_url mit
          Blur+Gradient für Bestandsrestaurants ohne dediziertes Splash-Media. */}
      {mediaUrl.length > 0 ? (
        <>
          {mediaType === "video" ? (
            <video
              aria-hidden
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              poster={restaurant.splash_image_url?.trim() || undefined}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            >
              <source src={mediaUrl} />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              aria-hidden
              src={mediaUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
          />
        </>
      ) : legacyImageUrl.length > 0 ? (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${legacyImageUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "blur(2px) brightness(0.55)",
              transform: "scale(1.05)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(14,12,10,0.55) 0%, rgba(14,12,10,0.85) 60%, rgba(14,12,10,0.98) 100%)",
            }}
          />
        </>
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 30%, ${accent}33 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Share-Button oben rechts (fix positioniert über dem Hintergrund) */}
      <div className="absolute right-5 top-5 z-20">
        <ShareButton restaurantName={restaurant.name} slug={restaurant.slug} />
      </div>

      {/* Inhalt */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-16 pb-6">
        {/* Akzent-Streifen oben */}
        <div
          className="mx-auto mb-8 h-[3px] w-16 rounded-full"
          style={{ background: accent }}
        />

        {/* Restaurantname */}
        <h1
          className="text-center font-serif text-[2.6rem] font-light leading-tight tracking-tight"
          style={{ color: "#fff" }}
        >
          {restaurant.name}
        </h1>

        {/* Stadtteil / Adresse */}
        {(restaurant.stadtbezirk?.trim() || restaurant.adresse?.trim()) ? (
          <p
            className="mt-3 text-center text-[12px] tracking-[0.18em] uppercase"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {restaurant.stadtbezirk?.trim() || restaurant.adresse?.trim()}
          </p>
        ) : null}

        {/* Öffnungsstatus */}
        {statusBadge ? (
          <div className="mt-6 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold"
              style={{
                background: statusBadge.bg,
                color: statusBadge.text,
                border: `1px solid ${statusBadge.border}`,
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: statusBadge.dot }}
              />
              {statusBadge.label}
            </span>
          </div>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sekundär-Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/${restaurant.slug}/kontakt`}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-4 py-4 text-sm font-semibold transition-colors active:bg-white/[0.04]"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Kontakt</span>
          </Link>

          <LanguageButton
            slug={restaurant.slug}
            activeLanguages={
              (restaurant.active_languages ?? ["de"]).filter((c): c is SupportedLocale =>
                (SUPPORTED_LOCALES as readonly string[]).includes(c),
              ) as SupportedLocale[]
            }
            accent={accent}
          />
        </div>

        {/* Primär-CTA */}
        <Link
          href={`/${restaurant.slug}/karte`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold tracking-tight transition-transform active:scale-[0.98]"
          style={{
            background: accent,
            color: "#fff",
            boxShadow: `0 10px 30px ${accent}55`,
          }}
        >
          Zur Speisekarte
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
