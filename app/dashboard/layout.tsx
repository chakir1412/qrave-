import { Roboto } from "next/font/google";
import type { ReactNode } from "react";

const roboto = Roboto({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={`${roboto.className} min-h-dvh antialiased`}>{children}</div>;
}
