import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
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
  title: "Qrave – Digitale Speisekarte",
  description: "Digitale Speisekarte und Restaurant-Dashboard mit Supabase & Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/twemoji.min.js"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${dmSans.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
