import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
