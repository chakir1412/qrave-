"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const WHATSAPP =
  "https://wa.me/491738996449?text=Hallo%2C%20ich%20m%C3%B6chte%20Qrave%20f%C3%BCr%20mein%20Restaurant%20testen.";
const WHATSAPP_SUPPORT =
  "https://wa.me/491738996449?text=Hallo%2C%20ich%20habe%20eine%20Frage%20zu%20Qrave.";

const WEEK_DATA = [98, 112, 87, 134, 158, 184, 73];
const WEEK_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TOP_GERICHTE = [
  { name: "Handkäs' mit Musik", val: 184 },
  { name: "Schnitzel", val: 147 },
  { name: "Grüne Sosse", val: 132 },
  { name: "Tafelspitz", val: 98 },
];
const PEAK_ZEITEN = [
  { name: "Mittag 11–15h", val: 312 },
  { name: "Abend 15–22h", val: 287 },
  { name: "Morgen 6–11h", val: 143 },
  { name: "Nacht 22–6h", val: 54 },
];
const SPECIALS = [
  { name: "Rinderroulade", price: "18,90 €" },
  { name: "Tafelspitz", price: "22,50 €" },
  { name: "Zwiebelrostbraten", price: "21,80 €" },
];
const LANGS = [
  { flag: "🇩🇪", label: "Deutsch", note: "erkannt" },
  { flag: "🇬🇧", label: "English" },
  { flag: "🇹🇷", label: "Türkçe" },
  { flag: "🇸🇦", label: "العربية" },
];
const FILTER_ITEMS = [
  { name: "Grüne Soße", price: "9,50 €", tags: ["vegan", "veg"] },
  { name: "Käsespätzle", price: "14,90 €", tags: ["veg"] },
  { name: "Gemüsepfanne", price: "13,50 €", tags: ["vegan", "veg", "gluten"] },
  { name: "Schnitzel", price: "16,80 €", tags: ["meat"] },
];
const FAQS = [
  {
    q: "Wirklich kostenlos — was ist der Haken?",
    a: "Keiner. Qrave finanziert sich anders — nicht über dich. Restaurants zahlen nie, weder heute noch in Zukunft.",
  },
  {
    q: "Muss ich etwas installieren oder selbst bauen?",
    a: "Nein. Du schickst uns deine Speisekarte — wir bauen sie auf. Du bekommst einen fertigen QR-Code.",
  },
  {
    q: "Was wenn ich meine Karte ändern will?",
    a: "Änderungen machst du direkt im Dashboard selbst — sofort live, kein Neudruck nötig.",
  },
  {
    q: "Können meine Gäste die Papierkarte trotzdem benutzen?",
    a: "Natürlich. Qrave ergänzt deine Karte — sie ersetzt sie nicht. Beide können gleichzeitig existieren.",
  },
  {
    q: "Wie lange dauert die Einrichtung?",
    a: "In der Regel unter 24 Stunden. Du schickst die Karte — wir liefern den QR-Code.",
  },
];

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function Home() {
  /* ────── Feature 01: KI-Import (Progressbar + Rows) ────── */
  const [kiPct, setKiPct] = useState(0);
  const [kiCheck, setKiCheck] = useState(false);
  const [kiRows, setKiRows] = useState<boolean[]>([false, false, false]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    function cycle() {
      if (cancelled) return;
      setKiPct(0);
      setKiCheck(false);
      setKiRows([false, false, false]);
      let pct = 0;
      interval = setInterval(() => {
        if (cancelled) return;
        pct = Math.min(pct + 2, 100);
        setKiPct(pct);
        if (pct >= 100) {
          if (interval) clearInterval(interval);
          setKiCheck(true);
          pendingTimeouts.push(setTimeout(() => setKiRows([true, false, false]), 60));
          pendingTimeouts.push(setTimeout(() => setKiRows([true, true, false]), 180));
          pendingTimeouts.push(setTimeout(() => setKiRows([true, true, true]), 300));
          pendingTimeouts.push(setTimeout(cycle, 4000));
        }
      }, 30);
    }

    cycle();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      pendingTimeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  /* ────── Feature 02: Sprach-Pills (Rotation) ────── */
  const [activeLang, setActiveLang] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setActiveLang((i) => (i + 1) % LANGS.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  /* ────── Feature 03: Live Diff (Preisänderung) ────── */
  const [diffChanged, setDiffChanged] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout>[] = [];
    function cycle() {
      if (cancelled) return;
      pending.push(
        setTimeout(() => {
          setDiffChanged(true);
          pending.push(
            setTimeout(() => {
              setDiffChanged(false);
              pending.push(setTimeout(cycle, 3000));
            }, 1500),
          );
        }, 2000),
      );
    }
    cycle();
    return () => {
      cancelled = true;
      pending.forEach((t) => clearTimeout(t));
    };
  }, []);

  /* ────── Feature 04: Allergene-Filter ────── */
  const [filters, setFilters] = useState<Set<string>>(new Set(["vegan", "veg"]));
  function toggleFilter(tag: string) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  /* ────── Feature 05: Tages-Special (Typewriter) ────── */
  const [specialIdx, setSpecialIdx] = useState(0);
  const [specialName, setSpecialName] = useState("");
  const [specialPriceShown, setSpecialPriceShown] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let pending: ReturnType<typeof setTimeout>[] = [];
    const s = SPECIALS[specialIdx % SPECIALS.length];
    setSpecialName("");
    setSpecialPriceShown(false);
    let i = 0;
    interval = setInterval(() => {
      if (cancelled) return;
      if (i < s.name.length) {
        i += 1;
        setSpecialName(s.name.slice(0, i));
      } else {
        if (interval) clearInterval(interval);
        setSpecialPriceShown(true);
        pending.push(
          setTimeout(() => {
            setSpecialIdx((idx) => idx + 1);
          }, 3500),
        );
      }
    }, 55);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      pending.forEach((t) => clearTimeout(t));
    };
  }, [specialIdx]);

  /* ────── Dashboard: Scan-Counter Ticker + Datum ────── */
  /* ────── Dashboard IntersectionObserver — Trigger für alle Dash-Animations ────── */
  const dashRef = useRef<HTMLDivElement | null>(null);
  const chartPathRef = useRef<SVGPathElement | null>(null);
  const [dashVisible, setDashVisible] = useState(false);

  useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setDashVisible(true);
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [scanTicker, setScanTicker] = useState(0);
  useEffect(() => {
    if (!dashVisible) return;
    const target = 73;
    const duration = 1500;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setScanTicker(Math.round(target * ease));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dashVisible]);

  /* Chart: Pfad zeichnet sich von links nach rechts via stroke-dashoffset. */
  useEffect(() => {
    if (!dashVisible) return;
    const p = chartPathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    // Reflow erzwingen, sonst greift die Transition nicht.
    void p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset 1.2s ease-in-out";
    p.style.strokeDashoffset = "0";
  }, [dashVisible]);

  const [todayString, setTodayString] = useState("");
  useEffect(() => {
    setTodayString(
      new Date().toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

  /* ────── Dashboard Chart Path ────── */
  const chart = useMemo(() => {
    const W = 340;
    const H = 80;
    const pad = 6;
    const max = Math.max(...WEEK_DATA, 1);
    const pts = WEEK_DATA.map((v, i) => ({
      x: pad + (i * (W - 2 * pad)) / (WEEK_DATA.length - 1),
      y: H - pad - (v / max) * (H - 2 * pad),
    }));
    const avg = WEEK_DATA.reduce((a, b) => a + b, 0) / WEEK_DATA.length;
    const avgY = H - pad - (avg / max) * (H - 2 * pad);
    return { path: buildSmoothPath(pts), pts, avgY, W, H };
  }, []);

  /* ────── Dashboard Range Pills + FAQ ────── */
  const [rangePill, setRangePill] = useState<"7" | "30" | "monat">("7");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <main>
      <style>{`
        :root {
          --bg:#06040e;
          --bg-2:#0d0918;
          --purple:#9333ea;
          --purple-2:#7c3aed;
          --purple-3:#a855f7;
          --card:rgba(255,255,255,0.04);
          --card-border:rgba(255,255,255,0.08);
          --line:rgba(255,255,255,0.06);
          --text:#fff;
          --m60:rgba(255,255,255,0.6);
          --m50:rgba(255,255,255,0.5);
          --m40:rgba(255,255,255,0.4);
          --m15:rgba(255,255,255,0.15);
          --display: var(--font-roboto), "Roboto", system-ui, sans-serif;
          --body: var(--font-dm-sans), "DM Sans", system-ui, sans-serif;
        }
        html { scroll-behavior:smooth; }
        body { background:var(--bg); color:#fff; font-family:var(--body); overflow-x:hidden; }
        .qrl a { color:inherit; text-decoration:none; }

        /* beams */
        .beams { position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
        .beams svg { width:100%; height:100%; }

        .wrap { max-width:1200px; margin:0 auto; padding:0 24px; position:relative; z-index:1; }

        /* logo */
        .logo { display:inline-flex; align-items:center; gap:6px; font-family:var(--display); font-weight:900; font-size:20px; color:#fff; letter-spacing:-.03em; }
        .logo .dot { width:7px; height:7px; border-radius:50%; background:linear-gradient(135deg,var(--purple),var(--purple-2)); box-shadow:0 0 12px rgba(147,51,234,.7); }

        /* navbar */
        .nav { position:sticky; top:0; z-index:50; background:rgba(6,4,14,.85); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border-bottom:1px solid var(--line); }
        .nav-inner { max-width:1200px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .nav-right { display:flex; align-items:center; gap:18px; }
        .nav-link { font-family:var(--body); font-size:14px; color:var(--m60); transition:color .2s; cursor:pointer; }
        .nav-link:hover { color:#fff; }

        /* buttons */
        .btn { display:inline-flex; align-items:center; gap:8px; padding:14px 22px; border-radius:12px; font-family:var(--body); font-weight:500; font-size:15px; cursor:pointer; border:none; transition:transform .2s, box-shadow .2s, background .2s; }
        .btn-primary { background:linear-gradient(135deg,var(--purple),var(--purple-2)); color:#fff; box-shadow:0 0 24px rgba(147,51,234,.4); }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 0 36px rgba(147,51,234,.65); }
        .btn-primary .arr { transition:transform .25s; }
        .btn-primary:hover .arr { transform:translateX(3px); }
        .btn-ghost { background:transparent; color:rgba(255,255,255,.6); border:1px solid var(--card-border); }
        .btn-ghost:hover { color:#fff; border-color:rgba(255,255,255,.18); }
        .btn-sm { padding:10px 16px; font-size:14px; border-radius:10px; }

        /* HERO */
        .hero { padding:80px 0 0; position:relative; overflow:hidden; }
        .hero-split { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; padding:20px 0 60px; }
        .hero-copy { display:flex; flex-direction:column; align-items:flex-start; text-align:left; }
        .badge { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; border-radius:999px; border:1px solid rgba(147,51,234,.4); background:rgba(147,51,234,.08); font-family:var(--body); font-size:13px; color:rgba(255,255,255,.85); margin-bottom:24px; }
        .badge .glyph { color:var(--purple-3); }
        .h1 { font-family:var(--display); font-weight:900; font-size:clamp(32px,4vw,56px); line-height:1.04; letter-spacing:-.03em; max-width:600px; margin:0; text-wrap:balance; }
        .h1 .grad { background:linear-gradient(135deg,var(--purple-3),var(--purple),var(--purple-2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .sub { font-family:var(--body); font-size:17px; color:var(--m60); max-width:420px; margin:20px 0 0; line-height:1.55; }
        .hero-ctas { margin-top:28px; display:flex; gap:12px; flex-wrap:wrap; }
        .trust-pills { margin-top:18px; display:flex; flex-wrap:wrap; align-items:center; font-family:var(--body); font-size:13px; color:var(--m50); }
        .trust-pills span { padding:0 14px; position:relative; }
        .trust-pills span + span::before { content:"·"; position:absolute; left:-2px; top:0; color:var(--m40); }
        .trust-pills .ok { color:var(--purple-3); margin-right:5px; }

        /* phone */
        .hero-mockup { display:flex; justify-content:center; align-items:center; position:relative; z-index:2; padding:40px 60px; overflow:visible; }
        .hero-mockup::before { content:""; position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:700px; height:280px; background:radial-gradient(ellipse,rgba(147,51,234,.18) 0%,transparent 65%); pointer-events:none; }
        .phone-wrap { position:relative; display:inline-block; overflow:visible; filter:drop-shadow(0 40px 80px rgba(0,0,0,.5)) drop-shadow(0 0 60px rgba(147,51,234,.15)); }

        /* Floating Cards */
        .fc { position:absolute; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); background:rgba(10,6,20,.92); border:1px solid rgba(147,51,234,.25); border-radius:16px; padding:14px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05),inset 0 1px 0 rgba(255,255,255,.06); white-space:nowrap; animation:qFloat 4s ease-in-out infinite; min-width:150px; z-index:10; }
        .fc-1 { top:50px; right:-130px; animation-delay:0s; }
        .fc-2 { bottom:100px; right:-120px; animation-delay:.8s; }
        .fc-3 { bottom:160px; left:-110px; animation-delay:1.4s; }
        .fc-4 { top:80px; left:-120px; animation-delay:.4s; }
        @keyframes qFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        .fc-label { font-family:var(--body); font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:rgba(168,85,247,.7); margin-bottom:6px; font-weight:600; }
        .fc-value { font-family:var(--display); font-weight:900; font-size:26px; letter-spacing:-.03em; color:#fff; line-height:1; }
        .fc-sub { font-family:var(--body); font-size:11px; color:var(--m50); margin-top:2px; }
        .fc-green { color:#4ade80; font-size:11px; font-weight:600; margin-top:5px; display:flex; align-items:center; gap:4px; }
        .fc-dish { font-family:var(--body); font-size:13px; font-weight:600; color:#fff; }
        .fc-dish-sub { font-family:var(--body); font-size:11px; color:var(--m50); margin-top:1px; }
        .fc-dish-price { font-family:var(--display); font-weight:700; font-size:13px; color:var(--purple-3); margin-top:4px; }
        .fc-lang { display:flex; gap:6px; margin-top:6px; }
        .fc-flag { font-size:16px; }

        /* sections */
        section { padding:120px 0; position:relative; z-index:1; }
        .sec-label { font-family:var(--display); font-weight:700; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--purple-3); display:block; text-align:center; margin-bottom:14px; }
        .sec-head { text-align:center; margin-bottom:56px; }
        .sec-head h2 { font-family:var(--display); font-weight:900; font-size:clamp(30px,4vw,46px); letter-spacing:-.03em; line-height:1.1; max-width:22ch; margin:0 auto; text-wrap:balance; }

        /* steps */
        .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .step { background:var(--card); border:1px solid var(--card-border); border-radius:14px; padding:32px 28px; position:relative; overflow:hidden; transition:border-color .25s, transform .25s; }
        .step:hover { border-color:rgba(147,51,234,.4); transform:translateY(-3px); }
        .step .num { font-family:var(--display); font-weight:900; font-size:52px; color:var(--m15); position:absolute; top:16px; left:22px; line-height:1; letter-spacing:-.04em; }
        .step h3 { font-family:var(--display); font-weight:900; font-size:21px; letter-spacing:-.02em; margin-top:68px; }
        .step p { font-family:var(--body); font-size:15px; color:var(--m60); margin-top:10px; line-height:1.55; }

        /* features */
        .feat-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch; }
        .feat-col { display:flex; flex-direction:column; gap:14px; }
        .feat-card { background:var(--card); border:1px solid var(--card-border); border-radius:16px; padding:40px; position:relative; overflow:hidden; transition:border-color .3s, transform .3s; height:100%; box-sizing:border-box; }
        .feat-card:hover { border-color:rgba(147,51,234,.35); transform:translateY(-3px); }
        .feat-num { font-family:var(--display); font-weight:900; font-size:72px; line-height:1; letter-spacing:-.04em; color:rgba(147,51,234,.12); position:absolute; top:24px; right:28px; pointer-events:none; transition:color .3s; }
        .feat-card:hover .feat-num { color:rgba(147,51,234,.2); }
        .feat-tag { font-family:var(--body); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--purple-3); margin-bottom:14px; display:block; font-weight:600; }
        .feat-title { font-family:var(--display); font-weight:900; font-size:24px; letter-spacing:-.025em; line-height:1.15; margin-bottom:14px; }
        .feat-body { font-family:var(--body); font-size:15px; color:var(--m60); line-height:1.65; max-width:44ch; }
        .feat-vis { margin-top:28px; }

        /* KI */
        .ki-input { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:12px 16px; font-family:var(--body); font-size:13px; color:var(--m60); display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .ki-file { font-size:12px; color:var(--purple-3); font-weight:600; }
        .ki-progress { height:2px; background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden; margin-bottom:16px; }
        .ki-bar { height:100%; background:linear-gradient(90deg,var(--purple),var(--purple-3)); border-radius:2px; transition:width .05s linear; }
        .ki-result { display:flex; flex-direction:column; gap:6px; }
        .ki-row { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:rgba(255,255,255,.03); border:1px solid var(--line); border-radius:8px; font-family:var(--body); font-size:13px; opacity:0; transform:translateY(4px); transition:opacity .3s, transform .3s; }
        .ki-row.show { opacity:1; transform:translateY(0); }
        .ki-row .kp { font-family:var(--display); font-weight:700; font-size:12px; color:var(--purple-3); }

        /* Lang pills */
        .lang-pills { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
        .lang-pill { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(255,255,255,.04); border:1px solid var(--card-border); border-radius:10px; font-family:var(--body); font-size:13px; color:var(--m60); transition:opacity .35s, transform .35s, border-color .2s, color .2s, background .2s; }
        .lang-pill.active { border-color:rgba(147,51,234,.5); color:#e8d5ff; background:rgba(147,51,234,.1); }
        .lang-flag { font-size:18px; line-height:1; }
        .lang-auto { font-size:10px; color:var(--purple-3); margin-left:auto; letter-spacing:.08em; }

        /* Diff */
        .diff-card { background:rgba(255,255,255,.03); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .diff-header { padding:10px 14px; border-bottom:1px solid var(--line); font-family:var(--body); font-size:11px; color:var(--m40); display:flex; justify-content:space-between; }
        .diff-rows { padding:8px 0; }
        .diff-row { display:flex; justify-content:space-between; padding:7px 14px; font-family:var(--body); font-size:13px; transition:background .3s; }
        .diff-row.changed { background:rgba(147,51,234,.1); }
        .diff-row .price { font-family:var(--display); font-weight:700; font-size:12px; color:var(--purple-3); }
        .diff-badge { display:inline-flex; align-items:center; gap:5px; font-size:10px; padding:3px 8px; border-radius:999px; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.3); color:#4ade80; font-family:var(--body); }
        .diff-dot { width:5px; height:5px; border-radius:50%; background:#4ade80; animation:livepulse 1.6s infinite; }
        @keyframes livepulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(.8); } }

        /* Filter */
        .filter-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:20px; }
        .fchip { padding:9px 16px; border-radius:999px; border:1px solid var(--card-border); font-family:var(--body); font-size:13px; color:var(--m50); cursor:pointer; transition:all .2s; user-select:none; }
        .fchip.on { background:rgba(147,51,234,.15); border-color:rgba(147,51,234,.5); color:#e8d5ff; }
        .filter-result { margin-top:16px; display:flex; flex-direction:column; gap:6px; min-height:80px; }
        .fitem { display:flex; justify-content:space-between; padding:8px 14px; background:rgba(255,255,255,.03); border:1px solid var(--line); border-radius:8px; font-family:var(--body); font-size:13px; transition:opacity .25s, transform .25s, max-height .25s, padding .25s, margin .25s; max-height:60px; }
        .fitem.hidden { opacity:0; transform:scale(.97); max-height:0; padding-top:0; padding-bottom:0; margin:0; border-width:0; pointer-events:none; }
        .fitem .fprice { font-family:var(--display); font-weight:700; font-size:12px; color:var(--purple-3); }

        /* Special */
        .special-card { background:rgba(147,51,234,.08); border:1px solid rgba(147,51,234,.25); border-radius:12px; padding:16px 20px; margin-top:20px; min-height:180px; overflow:hidden; }
        .special-eyebrow { font-family:var(--body); font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:var(--purple-3); margin-bottom:6px; }
        .special-name { font-family:var(--display); font-weight:900; font-size:18px; letter-spacing:-.02em; margin-bottom:4px; min-height:26px; }
        .special-desc { font-family:var(--body); font-size:13px; color:var(--m60); }
        .special-price { font-family:var(--display); font-weight:900; font-size:22px; color:var(--purple-3); margin-top:10px; min-height:30px; }
        .special-badge { display:inline-flex; align-items:center; gap:5px; font-size:10px; padding:3px 10px; border-radius:999px; background:rgba(147,51,234,.2); border:1px solid rgba(147,51,234,.4); color:#c084fc; font-family:var(--body); margin-top:8px; }
        .special-cursor { display:inline-block; width:2px; height:14px; background:var(--purple-3); margin-left:2px; animation:blink .8s infinite; vertical-align:middle; }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }

        /* Dashboard */
        .dash-section { padding:120px 0; position:relative; z-index:1; overflow:hidden; }
        .dash-section::before { content:""; position:absolute; right:-200px; top:-100px; width:600px; height:600px; border-radius:50%; background:radial-gradient(circle,rgba(147,51,234,.12) 0%,transparent 65%); pointer-events:none; }
        .dash-layout { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; }
        .dash-copy .sec-label { text-align:left; margin-bottom:12px; }
        .dash-copy h2 { font-family:var(--display); font-weight:900; font-size:clamp(28px,3.5vw,42px); letter-spacing:-.03em; line-height:1.1; margin-bottom:20px; text-wrap:balance; }
        .dash-copy p { font-family:var(--body); font-size:16px; color:var(--m60); line-height:1.65; margin-bottom:28px; }
        .dash-features { display:flex; flex-direction:column; gap:14px; }
        .dash-feat { display:flex; align-items:flex-start; gap:14px; }
        .dash-feat-icon { width:36px; height:36px; border-radius:8px; background:rgba(147,51,234,.12); border:1px solid rgba(147,51,234,.25); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; margin-top:1px; }
        .dash-feat-text strong { font-family:var(--display); font-weight:700; font-size:14px; display:block; margin-bottom:2px; }
        .dash-feat-text span { font-family:var(--body); font-size:13px; color:var(--m60); }

        .dash-ui { position:relative; }
        .dash-card { background:rgba(13,9,24,.95); border:1px solid rgba(147,51,234,.2); border-radius:18px; padding:24px; box-shadow:0 0 80px rgba(147,51,234,.15),0 24px 60px rgba(0,0,0,.5); }
        .dui-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .dui-greeting { font-family:var(--display); font-weight:900; font-size:16px; letter-spacing:-.02em; }
        .dui-greeting span { color:var(--purple-3); }
        .dui-date { font-family:var(--body); font-size:11px; color:var(--m40); }
        .dui-live { display:flex; align-items:center; gap:6px; font-family:var(--body); font-size:11px; color:#4ade80; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.3); border-radius:999px; padding:4px 10px; }
        .dui-live-dot { width:5px; height:5px; border-radius:50%; background:#4ade80; animation:qDotPulse 1.5s infinite; }
        @keyframes qDotPulse {
          0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
          100% { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
        }
        .dui-row-anim { opacity:0; transform:translateY(8px); transition:opacity .5s ease, transform .5s ease; }
        .dui-row-anim.show { opacity:1; transform:translateY(0); }
        .dui-item-stack { flex-direction:column; align-items:stretch; gap:4px; }
        .dui-item-top { display:flex; justify-content:space-between; align-items:center; width:100%; }
        .dui-bar { height:2px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden; }
        .dui-bar-fill { height:100%; background:linear-gradient(90deg,var(--purple),var(--purple-3)); border-radius:999px; transition:width .8s ease-out; }

        .dui-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
        .dui-kpi { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:12px; }
        .dui-kpi-label { font-family:var(--body); font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:var(--m40); margin-bottom:5px; }
        .dui-kpi-val { font-family:var(--display); font-weight:900; font-size:34px; letter-spacing:-.025em; }
        .dui-kpi-delta { font-family:var(--body); font-size:10px; color:#4ade80; margin-top:3px; }

        .dui-chart-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:16px; margin-bottom:14px; }
        .dui-chart-header { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:14px; }
        .dui-chart-title { font-family:var(--body); font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:var(--m40); }
        .dui-chart-total { font-family:var(--display); font-weight:900; font-size:22px; letter-spacing:-.025em; }
        .dui-chart-sub { font-family:var(--body); font-size:10px; color:var(--m40); margin-top:1px; }
        .dui-svg { width:100%; height:80px; display:block; overflow:visible; }
        .dui-range { display:flex; gap:6px; margin-top:10px; }
        .dui-pill { font-family:var(--body); font-size:9px; padding:4px 10px; border-radius:999px; border:1px solid var(--card-border); color:var(--m50); cursor:pointer; transition:all .2s; }
        .dui-pill.active { background:rgba(147,51,234,.2); border-color:rgba(147,51,234,.5); color:#e8d5ff; }
        .dui-items-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .dui-items-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:12px; }
        .dui-items-title { font-family:var(--body); font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:var(--m40); margin-bottom:10px; }
        .dui-item { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid rgba(255,255,255,.04); }
        .dui-item:last-child { border-bottom:none; }
        .dui-item-name { font-family:var(--body); font-size:11px; color:rgba(255,255,255,.75); }
        .dui-item-val { font-family:var(--display); font-weight:700; font-size:11px; color:var(--purple-3); }

        /* pricing */
        .pricing { padding:120px 0; position:relative; z-index:1; }
        .pricing-card { max-width:760px; margin:0 auto; text-align:center; background:linear-gradient(135deg,rgba(147,51,234,.18),rgba(124,58,237,.12)); border:1px solid rgba(147,51,234,.35); border-radius:24px; padding:64px 32px; box-shadow:0 0 80px rgba(147,51,234,.2),inset 0 1px 0 rgba(255,255,255,.05); position:relative; overflow:hidden; }
        .pricing-card::before { content:""; position:absolute; top:-100px; left:50%; transform:translateX(-50%); width:400px; height:400px; border-radius:50%; background:radial-gradient(circle,rgba(147,51,234,.35),transparent 60%); pointer-events:none; }
        .pricing-card > * { position:relative; z-index:1; }
        .pricing-badge { display:inline-flex; padding:6px 14px; border-radius:999px; background:rgba(0,0,0,.4); border:1px solid rgba(147,51,234,.5); font-family:var(--display); font-weight:700; font-size:11px; letter-spacing:.2em; color:var(--purple-3); margin-bottom:24px; }
        .pricing-card h2 { font-family:var(--display); font-weight:900; font-size:clamp(26px,3.5vw,40px); letter-spacing:-.025em; line-height:1.1; max-width:18ch; margin:0 auto; text-wrap:balance; }
        .pricing-card .body { font-family:var(--body); font-size:17px; color:var(--m60); max-width:48ch; margin:18px auto 0; line-height:1.5; }
        .pricing-checks { margin:32px 0; display:flex; justify-content:center; gap:28px; flex-wrap:wrap; font-family:var(--body); font-size:15px; color:rgba(255,255,255,.85); }
        .pricing-checks span { display:inline-flex; align-items:center; gap:8px; }
        .pricing-checks .ok { color:var(--purple-3); font-weight:700; }

        /* FAQ */
        .faq-list { max-width:760px; margin:0 auto; border-top:1px solid var(--card-border); }
        .faq-item { border-bottom:1px solid var(--card-border); }
        .faq-q { width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:22px 4px; background:transparent; border:none; cursor:pointer; font-family:var(--display); font-weight:700; font-size:17px; color:#fff; text-align:left; transition:color .2s; }
        .faq-q:hover { color:var(--purple-3); }
        .faq-q .plus { width:28px; height:28px; border-radius:50%; border:1px solid var(--card-border); display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--m60); flex-shrink:0; transition:transform .25s, background .25s, color .25s; }
        .faq-item.open .faq-q { color:var(--purple-3); }
        .faq-item.open .faq-q .plus { transform:rotate(45deg); background:rgba(147,51,234,.15); color:var(--purple-3); border-color:rgba(147,51,234,.4); }
        .faq-a { max-height:0; overflow:hidden; transition:max-height .35s ease; }
        .faq-a-inner { padding:0 4px 22px; font-family:var(--body); font-size:15px; color:var(--m60); line-height:1.6; max-width:60ch; }
        .faq-item.open .faq-a { max-height:240px; }

        /* footer */
        footer { padding:32px 0; border-top:1px solid var(--card-border); position:relative; z-index:1; }
        .foot-inner { max-width:1200px; margin:0 auto; padding:0 24px; display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap; font-family:var(--body); font-size:13px; color:var(--m50); }
        .foot-inner .left { display:inline-flex; align-items:center; gap:14px; }
        .foot-inner .right { display:inline-flex; gap:18px; }
        .foot-inner a:hover { color:#fff; }

        @media (max-width:900px) {
          .nav-right .nav-link { display:none; }
          .hero-split { grid-template-columns:1fr; gap:48px; }
          .hero-copy { align-items:center; text-align:center; }
          .h1 { text-align:center; margin:0 auto; }
          .sub { margin:20px auto 0; }
          .hero-ctas { justify-content:center; }
          .trust-pills { justify-content:center; }
          .steps { grid-template-columns:1fr; }
          .feat-grid { grid-template-columns:1fr; }
          .feat-num { font-size:52px; }
          .dash-layout { grid-template-columns:1fr; gap:40px; }
          .dash-copy .sec-label, .dash-copy h2, .dash-copy p { text-align:center; }
          .hero-mockup { padding:0 20px 40px; }
          section, .pricing, .dash-section { padding:80px 0; }
        }
        @media (max-width:540px) {
          .fc { display:none; }
          .trust-pills { flex-direction:column; gap:8px; }
          .trust-pills span + span::before { display:none; }
          .trust-pills span { padding:0; }
          .dui-kpis { grid-template-columns:1fr 1fr; }
          .dui-items-row { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="qrl">
        {/* BEAMS */}
        <div className="beams" aria-hidden>
          <svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="b1" cx="18%" cy="0%" r="50%">
                <stop offset="0%" stopColor="#9333ea" stopOpacity="0.32" />
                <stop offset="55%" stopColor="#9333ea" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="b2" cx="0%" cy="22%" r="40%">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </radialGradient>
              <filter id="bf" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="40" />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#b1)" filter="url(#bf)" />
            <rect width="100%" height="100%" fill="url(#b2)" filter="url(#bf)" />
          </svg>
        </div>

        {/* NAVBAR */}
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="logo">
              <span className="dot" />
              qrave
            </Link>
            <div className="nav-right">
              <a href="#how" className="nav-link">So funktioniert&apos;s</a>
              <a href="#features" className="nav-link">Funktionen</a>
              <Link href="/login" className="nav-link">Anmelden</Link>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                Kostenlos starten <span className="arr">→</span>
              </a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <div className="hero-split">
              <div className="hero-copy">
                <span className="badge">
                  <span className="glyph">✦</span> Digitale Speisekarte
                </span>
                <h1 className="h1">
                  Deine digitale Speisekarte.
                  <br />
                  <span className="grad">Kostenlos. Für immer.</span>
                </h1>
                <p className="sub">
                  Wir bauen deine digitale Speisekarte auf — kostenlos, in 24 Stunden. Deine Gäste scannen, du siehst was sie interessiert.
                </p>
                <div className="hero-ctas">
                  <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    Jetzt kostenlos starten <span className="arr">→</span>
                  </a>
                  <Link href="/frankfurter-wirtshaus" className="btn btn-ghost">
                    Demo ansehen →
                  </Link>
                </div>
                <div className="trust-pills">
                  <span><span className="ok">✓</span> Keine Kreditkarte</span>
                  <span><span className="ok">✓</span> Kein Abo</span>
                  <span><span className="ok">✓</span> Immer kostenlos</span>
                </div>
              </div>

              {/* Phone Mockup */}
              <div className="hero-mockup">
                <div className="phone-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/hero-mockup.png" alt="Qrave Speisekarte" style={{ width: "320px", display: "block" }} />

                  {/* Floating Cards */}
                  <div className="fc fc-1">
                    <div className="fc-label">Scans heute</div>
                    <div className="fc-value">73</div>
                    <div className="fc-green">↑ +18% vs. gestern</div>
                  </div>
                  <div className="fc fc-2">
                    <div className="fc-label">Top Gericht</div>
                    <div className="fc-dish">Handkäs&apos; mit Musik</div>
                    <div className="fc-dish-sub">184 Klicks diese Woche</div>
                    <div className="fc-dish-price">9,90 €</div>
                  </div>
                  <div className="fc fc-3">
                    <div className="fc-label">Verfügbar in</div>
                    <div className="fc-lang">
                      <span className="fc-flag">🇩🇪</span>
                      <span className="fc-flag">🇬🇧</span>
                      <span className="fc-flag">🇹🇷</span>
                      <span className="fc-flag">🇸🇦</span>
                    </div>
                    <div className="fc-sub" style={{ marginTop: 6 }}>Automatisch erkannt</div>
                  </div>
                  <div className="fc fc-4">
                    <div className="fc-label">Kein App-Download</div>
                    <div className="fc-dish">QR scannen — fertig</div>
                    <div className="fc-sub">iOS · Android · alle Browser</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW */}
        <section id="how">
          <div className="wrap">
            <span className="sec-label">So einfach geht&apos;s</span>
            <div className="sec-head"><h2>In 3 Schritten live</h2></div>
            <div className="steps">
              {[
                { n: "01", h: "Speisekarte einreichen", p: "Schick uns deine Karte als PDF oder Foto. Wir bauen sie auf — du schaust zu." },
                { n: "02", h: "QR-Code erhalten", p: "Du bekommst deinen persönlichen QR-Code. Einfach ausdrucken oder aufstellen." },
                { n: "03", h: "Gäste scannen", p: "Gäste scannen, Speisekarte öffnet sich. Fertig. Kein App-Download, kein Login." },
              ].map((s) => (
                <div key={s.n} className="step">
                  <div className="num">{s.n}</div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features">
          <div className="wrap">
            <span className="sec-label">Funktionen</span>
            <div className="sec-head"><h2>Alles was deine Gäste erwarten — und mehr</h2></div>

            <div className="feat-grid">
              {/* Spalte links: 01 + 03 */}
              <div className="feat-col">
                {/* 01 KI */}
                <div className="feat-card">
                  <div className="feat-num">01</div>
                  <span className="feat-tag">KI-Import</span>
                  <div className="feat-title">Speisekarte importieren<br />in 60 Sekunden</div>
                  <p className="feat-body">Foto oder PDF hochladen — die KI erkennt automatisch Kategorien, Gerichte und Preise. Kein Abtippen.</p>
                  <div className="feat-vis">
                    <div className="ki-input">
                      <span className="ki-file">speisekarte.pdf</span>
                      <span style={{ fontSize: 11, color: "var(--m40)" }}>wird analysiert</span>
                      <span style={{ marginLeft: "auto", color: "#4ade80", fontSize: 13, opacity: kiCheck ? 1 : 0, transition: "opacity .3s" }}>✓ fertig</span>
                    </div>
                    <div className="ki-progress">
                      <div className="ki-bar" style={{ width: `${kiPct}%` }} />
                    </div>
                    <div className="ki-result">
                      <div className={`ki-row${kiRows[0] ? " show" : ""}`}><span>Handkäs&apos; mit Musik</span><span className="kp">6,90 €</span></div>
                      <div className={`ki-row${kiRows[1] ? " show" : ""}`}><span>Grüne Soße</span><span className="kp">9,50 €</span></div>
                      <div className={`ki-row${kiRows[2] ? " show" : ""}`}><span>Schnitzel</span><span className="kp">16,80 €</span></div>
                    </div>
                  </div>
                </div>

                {/* 03 Live */}
                <div className="feat-card">
                  <div className="feat-num">03</div>
                  <span className="feat-tag">Echtzeit</span>
                  <div className="feat-title">Änderungen sofort live —<br />kein Neudruck</div>
                  <p className="feat-body">Preis anpassen, Gericht deaktivieren, neues Item hinzufügen — alles geht sofort live. Kein Warten, keine Druckkosten.</p>
                  <div className="feat-vis">
                    <div className="diff-card">
                      <div className="diff-header">
                        <span>Speisekarte</span>
                        <div className="diff-badge"><span className="diff-dot" />live</div>
                      </div>
                      <div className="diff-rows">
                        <div className="diff-row"><span>Handkäs&apos; mit Musik</span><span className="price">6,90 €</span></div>
                        <div className={`diff-row${diffChanged ? " changed" : ""}`}>
                          <span>Schnitzel</span>
                          <span className="price">{diffChanged ? "17,50 €" : "16,80 €"}</span>
                        </div>
                        <div className="diff-row"><span>Grüne Soße</span><span className="price">9,50 €</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spalte rechts: 02 + 04 */}
              <div className="feat-col">
                {/* 02 Lang */}
                <div className="feat-card">
                  <div className="feat-num">02</div>
                  <span className="feat-tag">Mehrsprachig</span>
                  <div className="feat-title">Deine Karte spricht<br />die Sprache deiner Gäste</div>
                  <p className="feat-body">Automatisch auf Deutsch, Englisch, Türkisch und Arabisch — der Gast sieht seine Sprache, ohne etwas tun zu müssen.</p>
                  <div className="feat-vis">
                    <div className="lang-pills">
                      {LANGS.map((l, i) => (
                        <div key={l.label} className={`lang-pill${i === activeLang ? " active" : ""}`}>
                          <span className="lang-flag">{l.flag}</span>
                          <span>{l.label}</span>
                          {i === activeLang && l.note ? <span className="lang-auto">{l.note}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 04 Filter */}
                <div className="feat-card">
                  <div className="feat-num">04</div>
                  <span className="feat-tag">Filter</span>
                  <div className="feat-title">Allergene &amp; Diät-Filter<br />direkt in der Karte</div>
                  <p className="feat-body">Gäste filtern selbst nach Vegan, Vegetarisch und Glutenfrei — keine Rückfragen, keine Missverständnisse.</p>
                  <div className="feat-vis">
                    <div className="filter-row">
                      {[
                        { tag: "vegan", label: "Vegan" },
                        { tag: "veg", label: "Vegetarisch" },
                        { tag: "gluten", label: "Glutenfrei" },
                      ].map((c) => (
                        <div
                          key={c.tag}
                          className={`fchip${filters.has(c.tag) ? " on" : ""}`}
                          onClick={() => toggleFilter(c.tag)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleFilter(c.tag); }}
                        >
                          {c.label}
                        </div>
                      ))}
                    </div>
                    <div className="filter-result">
                      {FILTER_ITEMS.map((it) => {
                        const show = filters.size === 0 || it.tags.some((t) => filters.has(t));
                        return (
                          <div key={it.name} className={`fitem${show ? "" : " hidden"}`}>
                            <span>{it.name}</span>
                            <span className="fprice">{it.price}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 05 Special — full width */}
            <div className="feat-card" style={{ marginTop: 14 }}>
              <div className="feat-num">05</div>
              <span className="feat-tag">Tages-Special</span>
              <div className="feat-title">Tagesangebot in Sekunden live schalten</div>
              <p className="feat-body">Tipp direkt im Dashboard was heute besonders ist — erscheint sofort als Banner oben in der Karte deiner Gäste.</p>
              <div className="feat-vis" style={{ maxWidth: 480 }}>
                <div className="special-card">
                  <div className="special-eyebrow">✦ Tages-Special · heute</div>
                  <div className="special-name">
                    {specialName}
                    {!specialPriceShown ? <span className="special-cursor" /> : null}
                  </div>
                  <div className="special-desc">Frisch zubereitet · nur heute</div>
                  <div className="special-price">{specialPriceShown ? SPECIALS[specialIdx % SPECIALS.length].price : ""}</div>
                  <div className="special-badge"><span className="diff-dot" />live in deiner Karte</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DASHBOARD SECTION */}
        <section className="dash-section">
          <div className="wrap">
            <div className="dash-layout">
              <div className="dash-copy">
                <span className="sec-label" style={{ textAlign: "left" }}>Dashboard</span>
                <h2>Dein Restaurant in Zahlen — in Echtzeit</h2>
                <p>Mit dem Qrave Dashboard siehst du auf einen Blick wie deine Gäste mit deiner Karte interagieren. Welche Gerichte am beliebtesten sind, wann der Peak kommt — kostenlos inklusive.</p>
                <div className="dash-features">
                  {[
                    { icon: "📈", title: "Scans in Echtzeit", text: "Sieh wann und wie oft deine Karte geöffnet wird — nach Tag und Tageszeit." },
                    { icon: "🍽️", title: "Meistgeklickte Gerichte", text: "Welche Gerichte deine Gäste am meisten interessieren — täglich aktuell." },
                    { icon: "⏰", title: "Peak-Zeiten", text: "Morgen, Mittag, Abend oder Nacht — du weißt wann es voll wird." },
                    { icon: "🥗", title: "Tages-Special & Mittagsangebot", text: "Verwalte Tagesangebote direkt im Dashboard — sofort live." },
                  ].map((f) => (
                    <div key={f.title} className="dash-feat">
                      <div className="dash-feat-icon">{f.icon}</div>
                      <div className="dash-feat-text">
                        <strong>{f.title}</strong>
                        <span>{f.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dash-ui">
                <div className="dash-card" ref={dashRef}>
                  <div className="dui-top">
                    <div>
                      <div className="dui-greeting">Guten Abend, <span>Frankfurter Wirtshaus</span></div>
                      <div className="dui-date">{todayString}</div>
                    </div>
                    <div className="dui-live"><span className="dui-live-dot" />Live</div>
                  </div>

                  <div className="dui-kpis">
                    <div className="dui-kpi">
                      <div className="dui-kpi-label">Scans heute</div>
                      <div className="dui-kpi-val">{scanTicker}</div>
                      <div className="dui-kpi-delta">↑ +18% vs. gestern</div>
                    </div>
                    <div className="dui-kpi">
                      <div className="dui-kpi-label">Diese Woche</div>
                      <div className="dui-kpi-val">846</div>
                      <div className="dui-kpi-delta">Mo–So</div>
                    </div>
                    <div className="dui-kpi">
                      <div className="dui-kpi-label">Stärkster Tag</div>
                      <div className="dui-kpi-val" style={{ fontSize: 18, marginTop: 4 }}>Sa</div>
                      <div className="dui-kpi-delta" style={{ color: "var(--m40)" }}>184 Scans</div>
                    </div>
                  </div>

                  <div className="dui-chart-card">
                    <div className="dui-chart-header">
                      <div>
                        <div className="dui-chart-title">Scans · letzte 7 Tage</div>
                        <div className="dui-chart-total">846</div>
                        <div className="dui-chart-sub">Unique Sessions</div>
                      </div>
                      <div className="dui-range">
                        {(["7", "30", "monat"] as const).map((k) => (
                          <span
                            key={k}
                            className={`dui-pill${rangePill === k ? " active" : ""}`}
                            onClick={() => setRangePill(k)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setRangePill(k); }}
                          >
                            {k === "7" ? "7 Tage" : k === "30" ? "30 Tage" : "Monat"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <svg className="dui-svg" viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none">
                      <defs>
                        <filter id="lg">
                          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#9333ea" floodOpacity="0.8" />
                          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#9333ea" floodOpacity="0.4" />
                        </filter>
                      </defs>
                      <line x1="0" y1={chart.avgY} x2={chart.W} y2={chart.avgY} stroke="#fff" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4,4" />
                      <path
                        ref={chartPathRef}
                        d={chart.path}
                        fill="none"
                        stroke="#9333ea"
                        strokeWidth="2"
                        filter="url(#lg)"
                      />
                      {chart.pts.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#9333ea" filter="url(#lg)" />
                      ))}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      {[0, 3, 6].map((i) => (
                        <span key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "var(--body)" }}>
                          {WEEK_DAYS[i]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="dui-items-row">
                    <div className="dui-items-card">
                      <div className="dui-items-title">Top Gerichte</div>
                      {TOP_GERICHTE.map((g, i) => (
                        <div
                          key={g.name}
                          className={`dui-item dui-row-anim${dashVisible ? " show" : ""}`}
                          style={{ transitionDelay: `${i * 120}ms` }}
                        >
                          <span className="dui-item-name">{g.name}</span>
                          <span className="dui-item-val">{g.val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="dui-items-card">
                      <div className="dui-items-title">Peak-Zeiten</div>
                      {PEAK_ZEITEN.map((p, i) => {
                        const max = Math.max(...PEAK_ZEITEN.map((x) => x.val));
                        const pct = Math.round((p.val / max) * 100);
                        return (
                          <div
                            key={p.name}
                            className={`dui-item dui-item-stack dui-row-anim${dashVisible ? " show" : ""}`}
                            style={{ transitionDelay: `${i * 120}ms` }}
                          >
                            <div className="dui-item-top">
                              <span className="dui-item-name">{p.name}</span>
                              <span className="dui-item-val">{p.val}</span>
                            </div>
                            <div className="dui-bar">
                              <div
                                className="dui-bar-fill"
                                style={{
                                  width: dashVisible ? `${pct}%` : "0%",
                                  transitionDelay: `${i * 120 + 200}ms`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="pricing">
          <div className="wrap">
            <div className="pricing-card">
              <span className="pricing-badge">100% Kostenlos</span>
              <h2>Kein Haken. Kein Abo. Keine versteckten Kosten.</h2>
              <p className="body">Qrave ist und bleibt kostenlos für Restaurants. Punkt.</p>
              <div className="pricing-checks">
                <span><span className="ok">✓</span> Kostenlose Einrichtung</span>
                <span><span className="ok">✓</span> Kostenlose Updates</span>
                <span><span className="ok">✓</span> Kostenlos für immer</span>
              </div>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Jetzt starten <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className="wrap">
            <span className="sec-label">Häufige Fragen</span>
            <div className="sec-head"><h2>Alles, was du wissen musst</h2></div>
            <div className="faq-list">
              {FAQS.map((f, i) => (
                <div key={i} className={`faq-item${faqOpen === i ? " open" : ""}`}>
                  <button
                    className="faq-q"
                    onClick={() => setFaqOpen((o) => (o === i ? null : i))}
                  >
                    {f.q}
                    <span className="plus">+</span>
                  </button>
                  <div className="faq-a">
                    <div className="faq-a-inner">{f.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="foot-inner">
            <div className="left">
              <Link href="/" className="logo" style={{ fontSize: 16 }}>
                <span className="dot" />
                qrave
              </Link>
              <span>© {new Date().getFullYear()} Qrave</span>
            </div>
            <div className="right">
              <a href={WHATSAPP_SUPPORT} target="_blank" rel="noopener noreferrer" style={{ color: "#c084fc" }}>
                💬 WhatsApp Support
              </a>
              <Link href="/impressum">Impressum</Link>
              <Link href="/datenschutz">Datenschutz</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

