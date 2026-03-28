import type { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function FounderLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html {
              background-color: #0c0c0f !important;
              min-height: 100%;
            }
            body {
              position: relative;
              background-color: #0c0c0f !important;
              min-height: 100vh !important;
              color: rgba(255,255,255,0.92);
              font-family: ${inter.style.fontFamily} !important;
            }
            body::before {
              content: "";
              position: fixed;
              inset: 0;
              z-index: 0;
              pointer-events: none;
              background:
                radial-gradient(ellipse 80% 55% at 92% 8%, rgba(255,92,26,0.2) 0%, transparent 55%),
                radial-gradient(ellipse 70% 70% at 0% 45%, rgba(91,155,255,0.16) 0%, transparent 52%),
                radial-gradient(ellipse 85% 50% at 88% 96%, rgba(52,232,158,0.14) 0%, transparent 55%);
            }
          `,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </>
  );
}
