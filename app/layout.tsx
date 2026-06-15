import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { DM_Sans, Geist, Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});
const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
  weight: ["300", "400", "500", "700", "900"],
});
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qrave – Die schönste digitale Speisekarte",
  description:
    "QR scannen — Menü sofort. Kostenlos, mehrsprachig, mit KI-Import. Kein App-Download, kein Zwang für Gäste.",
  icons: {
    icon: [
      { url: "/QR_logo.png", media: "(prefers-color-scheme: light)" },
      { url: "/QR_Logo_weiß.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/QR_logo.png", media: "(prefers-color-scheme: light)" },
      { url: "/QR_Logo_weiß.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/twemoji.min.js"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body
        className={`${dmSans.variable} ${roboto.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
