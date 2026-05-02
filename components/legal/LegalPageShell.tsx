import Image from "next/image";
import Link from "next/link";

type LegalPageShellProps = {
  children: React.ReactNode;
};

export function LegalPageShell({ children }: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#080810] font-sans antialiased">
      <header className="shrink-0 border-b border-white/10 px-6 py-4">
        <a href="https://qrave.menu" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="Qrave"
            width={120}
            height={36}
            className="h-8 w-auto"
            priority
          />
        </a>
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
