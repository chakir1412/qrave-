"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Back-Navigation mit slide-down-Animation der aktuellen Seite.
 *  Triggert die CSS-Klasse `qrave-slide-down-out` auf dem template.tsx-
 *  Wrapper (`.qrave-slide-up-in` als Selektor) und navigiert nach 260ms.
 *  Browser-Back ist davon unbeeinflusst — dafür braucht es ein
 *  popstate-Listener-Setup, was hier bewusst nicht gemacht wird. */
export function AnimatedBackLink({ href, children, className, style }: Props) {
  const router = useRouter();
  const [going, setGoing] = useState(false);

  function go(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (going) return;
    setGoing(true);
    // Template-Wrapper finden und Out-Animation triggern.
    const wrapper = document.querySelector(".qrave-slide-up-in");
    if (wrapper) {
      wrapper.classList.remove("qrave-slide-up-in");
      wrapper.classList.add("qrave-slide-down-out");
    }
    window.setTimeout(() => router.push(href), 240);
  }

  return (
    <a href={href} onClick={go} className={className} style={style}>
      {children}
    </a>
  );
}
