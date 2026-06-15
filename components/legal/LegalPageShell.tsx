import Link from "next/link";

type LegalPageShellProps = {
  children: React.ReactNode;
};

export function LegalPageShell({ children }: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#080810] font-sans antialiased">
      <header className="shrink-0 border-b border-white/10 px-6 py-4">
        <Link
          href="/"
          aria-label="Qrave Startseite"
          className="inline-flex items-center gap-[10px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/QR_Logo_weiß.png"
            alt=""
            className="logo-glow"
            style={{ height: 32, width: "auto", display: "block" }}
          />
          <span
            style={{
              fontFamily: "var(--font-roboto), system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 20,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              textTransform: "lowercase",
            }}
          >
            qrave
          </span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-[60px]">
        {children}
      </main>

      <footer className="shrink-0 border-t border-white/10 px-6 py-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 text-[15px] text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            ← Zurück
          </Link>
          <span>© 2026 Qrave · Digitale Speisekarten</span>
        </div>
      </footer>
    </div>
  );
}
