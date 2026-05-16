/**
 * Mini-Vorschauen aller Speisekarten-Templates. Jeder Frame rendert intern
 * auf 180×320 px (9:16) und wird per CSS-Transform auf die gewünschte
 * Außenbreite skaliert. Designs sind stark verkürzt — nur die wieder-
 * erkennbaren Marker (Farben, Hauptfont, Header-Stil, Item-Layout).
 */
"use client";

import { type ReactNode } from "react";

const BASE_W = 180;
const BASE_H = 320;

export type PreviewTemplateId =
  | "heritage" | "noir" | "clean" | "trattoria" | "minimal"
  | "playful" | "asian-dark" | "street-food" | "mediterranean";

type Variant = "default" | "splash" | "items";

export function TemplatePreview({
  id,
  width = 180,
}: {
  id: PreviewTemplateId;
  width?: number;
}) {
  if (id === "clean" || id === "playful") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PreviewStage width={width}>{renderFrame(id, "splash")}</PreviewStage>
        <span aria-hidden style={{ fontSize: Math.max(10, width * 0.07), color: "rgba(255,255,255,0.5)" }}>→</span>
        <PreviewStage width={width}>{renderFrame(id, "items")}</PreviewStage>
      </div>
    );
  }
  return <PreviewStage width={width}>{renderFrame(id, "default")}</PreviewStage>;
}

function PreviewStage({ children, width }: { children: ReactNode; width: number }) {
  const scale = width / BASE_W;
  const height = BASE_H * scale;
  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", borderRadius: 14 * scale, flexShrink: 0 }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: BASE_W,
          height: BASE_H,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function renderFrame(id: PreviewTemplateId, variant: Variant): ReactNode {
  switch (id) {
    case "heritage": return <HeritageFrame />;
    case "noir": return <NoirFrame />;
    case "clean": return variant === "splash" ? <CleanSplashFrame /> : <CleanItemsFrame />;
    case "trattoria": return <TrattoriaFrame />;
    case "minimal": return <MinimalFrame />;
    case "playful": return variant === "splash" ? <PlayfulSplashFrame /> : <PlayfulItemsFrame />;
    case "asian-dark": return <AsianDarkFrame />;
    case "street-food": return <StreetFoodFrame />;
    case "mediterranean": return <MediterraneanFrame />;
  }
}

/* ─────────────────────── Shared helpers ─────────────────────── */

function PhoneShell({ children, bg, borderColor = "rgba(255,255,255,0.12)" }: { children: ReactNode; bg: string; borderColor?: string }) {
  return (
    <div
      style={{
        width: BASE_W,
        height: BASE_H,
        background: bg,
        border: `1.5px solid ${borderColor}`,
        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function StatusBar({ color = "#fff" }: { color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 14px 3px", fontSize: 7, fontWeight: 600, color }}>
      <span>9:41</span>
      <div style={{ width: 32, height: 9, background: "#000", borderRadius: 6 }} />
      <span style={{ letterSpacing: 1 }}>●●●</span>
    </div>
  );
}

function HomeIndicator({ color = "rgba(255,255,255,0.3)" }: { color?: string }) {
  return (
    <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 60, height: 3, background: color, borderRadius: 2 }} />
  );
}

/* ─────────────────────── Heritage ─────────────────────── */

function HeritageFrame() {
  const COL = { bg: "#F5F0E8", text: "#1A1209", accent: "#C8894E", divider: "rgba(200,137,78,0.18)", muted: "#6E665C" };
  const items = [
    { name: "Handkäs' mit Musik", price: "6,90 €" },
    { name: "Schnitzel Wiener Art", price: "19,80 €" },
    { name: "Grüne Soße", price: "9,50 €" },
    { name: "Tafelspitz", price: "22,50 €" },
  ];
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(0,0,0,0.15)">
      <StatusBar color={COL.text} />
      <div style={{ textAlign: "center", padding: "10px 14px 8px", borderBottom: `1px solid ${COL.divider}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: COL.text, letterSpacing: "-0.02em" }}>Frankfurter Wirtshaus</div>
        <div style={{ fontSize: 7, letterSpacing: "0.2em", color: COL.accent, marginTop: 4, fontWeight: 500 }}>
          VORSPEISEN · HAUPTGERICHTE · GETRÄNKE
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "8px 0", borderBottom: `1px solid ${COL.divider}` }}>
        <div style={{ fontSize: 7, fontWeight: 600, color: COL.accent, borderBottom: `1.5px solid ${COL.accent}`, paddingBottom: 4 }}>VORSPEISEN</div>
        <div style={{ fontSize: 7, color: COL.muted }}>HAUPT</div>
        <div style={{ fontSize: 7, color: COL.muted }}>GETRÄNKE</div>
      </div>
      <div style={{ padding: "10px 14px" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < items.length - 1 ? `1px dotted ${COL.divider}` : "none" }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: COL.text }}>{it.name}</span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 500, color: COL.accent }}>{it.price}</span>
          </div>
        ))}
      </div>
      <HomeIndicator color="rgba(0,0,0,0.15)" />
    </PhoneShell>
  );
}

/* ─────────────────────── Noir ─────────────────────── */

function NoirFrame() {
  const COL = { bg: "#0a0805", text: "rgba(255,248,235,0.88)", gold: "#c9a84c", border: "rgba(201,168,76,0.14)", card: "rgba(255,248,235,0.03)", muted: "rgba(255,248,235,0.38)" };
  const items = [
    { name: "Old Fashioned", price: "13,00 €", emoji: "🥃" },
    { name: "Negroni", price: "12,00 €", emoji: "🖤" },
  ];
  return (
    <PhoneShell bg={COL.bg}>
      <StatusBar />
      <div style={{ padding: "8px 14px 8px", borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 6, letterSpacing: "0.22em", color: COL.gold, marginBottom: 2 }}>QRAVE.MENU</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 300, color: "#fff8eb", letterSpacing: "0.02em" }}>Noir & Ember</div>
      </div>
      <div style={{ display: "flex", padding: "8px 14px 0", gap: 12, borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 7, color: COL.gold, paddingBottom: 6, borderBottom: `1px solid ${COL.gold}`, marginBottom: -1 }}>COCKTAILS</div>
        <div style={{ fontSize: 7, color: COL.muted, paddingBottom: 6 }}>WEINE</div>
        <div style={{ fontSize: 7, color: COL.muted, paddingBottom: 6 }}>DESSERTS</div>
      </div>
      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: 56, background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(255,248,235,0.03))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{it.emoji}</div>
            <div style={{ padding: "5px 8px 7px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: "#fff8eb" }}>{it.name}</span>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 600, color: COL.gold }}>{it.price}</span>
            </div>
          </div>
        ))}
      </div>
      <HomeIndicator />
    </PhoneShell>
  );
}

/* ─────────────────────── Clean (Splash + Items) ─────────────────────── */

function CleanSplashFrame() {
  const COL = { bg: "#f0eeea", white: "#fff", text: "#1a1a1a", accent: "#2d6a4f", muted: "#999", border: "#e4e1db" };
  const cats = [
    { label: "Frühstück", emoji: "🥐" },
    { label: "Bowls", emoji: "🥗" },
    { label: "Suppen", emoji: "🍲" },
    { label: "Hauptg.", emoji: "🍽" },
  ];
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(0,0,0,0.12)">
      <StatusBar color={COL.text} />
      <div style={{ background: COL.white, padding: "8px 12px 10px", borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 600, color: COL.text }}>Grünzeit Café</div>
        <div style={{ fontSize: 6, color: COL.muted, marginTop: 1 }}>Café & Bistro</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "14px 10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[cats[0], cats[2]].map((c, i) => (
            <div key={i} style={{ position: "relative", background: COL.white, borderRadius: 8, paddingTop: 32, paddingBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginTop: 18 }}>
              <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", width: "85%", aspectRatio: "1/1", borderRadius: 6, background: "linear-gradient(135deg, #f5f2ee, #e8e4dd)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{c.emoji}</div>
              <div style={{ fontSize: 7, fontWeight: 500, color: COL.text, textAlign: "center" }}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          {[cats[1], cats[3]].map((c, i) => (
            <div key={i} style={{ position: "relative", background: COL.white, borderRadius: 8, paddingTop: 32, paddingBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginTop: 18 }}>
              <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", width: "85%", aspectRatio: "1/1", borderRadius: 6, background: "linear-gradient(135deg, #f5f2ee, #e8e4dd)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{c.emoji}</div>
              <div style={{ fontSize: 7, fontWeight: 500, color: COL.text, textAlign: "center" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}

function CleanItemsFrame() {
  const COL = { bg: "#f0eeea", white: "#fff", text: "#1a1a1a", accent: "#2d6a4f", muted: "#999", border: "#e4e1db" };
  const items = [
    { name: "Avocado Bowl", price: "14,50 €", emoji: "🥗" },
    { name: "Caesar Salad", price: "11,00 €", emoji: "🥬" },
    { name: "Trüffel-Pasta", price: "18,00 €", emoji: "🍝" },
  ];
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(0,0,0,0.12)">
      <StatusBar color={COL.text} />
      <div style={{ background: COL.white, padding: "8px 12px 8px", borderBottom: `1px solid ${COL.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: COL.muted }}>←</span>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 600, color: COL.text }}>Bowls & Salate</span>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "6px 10px", background: COL.white, borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 6, padding: "3px 8px", borderRadius: 999, border: `1px solid ${COL.accent}`, color: COL.accent, background: "rgba(45,106,79,0.09)" }}>Alle</div>
        <div style={{ fontSize: 6, padding: "3px 8px", borderRadius: 999, border: `1px solid ${COL.border}`, color: COL.muted }}>Vegan</div>
        <div style={{ fontSize: 6, padding: "3px 8px", borderRadius: 999, border: `1px solid ${COL.border}`, color: COL.muted }}>GF</div>
      </div>
      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it, i) => (
          <div key={i} style={{ position: "relative", background: COL.white, borderRadius: 8, padding: 8, paddingLeft: 56, marginTop: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ position: "absolute", top: -10, left: 8, width: 42, height: 42, borderRadius: 7, background: "linear-gradient(135deg, #f5f2ee, #e8e4dd)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>{it.emoji}</div>
            <div style={{ fontSize: 8, fontWeight: 500, color: COL.text }}>{it.name}</div>
            <div style={{ fontSize: 7, fontWeight: 600, color: COL.text, textAlign: "right", marginTop: 4 }}>{it.price}</div>
          </div>
        ))}
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}

/* ─────────────────────── Trattoria ─────────────────────── */

function TrattoriaFrame() {
  const COL = { bg: "#f5ede0", white: "#fffaf5", text: "#1c1410", accent: "#c0392b", muted: "#a08060", border: "#e8d8c4" };
  const items = [
    { name: "Margherita", price: "8,00 €", emoji: "🍕" },
    { name: "Bresaola", price: "8,90 €", emoji: "🫙" },
    { name: "Diavola", price: "10,00 €", emoji: "🌶" },
  ];
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(0,0,0,0.12)">
      <StatusBar color={COL.text} />
      <div style={{ padding: "8px 14px 0" }}>
        <div style={{ fontSize: 6, letterSpacing: "0.22em", color: COL.muted }}>QRAVE.MENU</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontStyle: "italic", color: COL.text, lineHeight: 1.1 }}>il Piatto</div>
      </div>
      <div style={{ display: "flex", padding: "10px 14px 0", gap: 14, borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 7, fontWeight: 500, color: COL.accent, paddingBottom: 6, borderBottom: `1.5px solid ${COL.accent}`, marginBottom: -1 }}>Pizza</div>
        <div style={{ fontSize: 7, color: COL.muted, paddingBottom: 6 }}>Pasta</div>
        <div style={{ fontSize: 7, color: COL.muted, paddingBottom: 6 }}>Drinks</div>
      </div>
      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: COL.white, borderRadius: 6, display: "flex", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #f0e4d0, #e8d4b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{it.emoji}</div>
            <div style={{ flex: 1, padding: "5px 8px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 600, color: COL.text }}>{it.name}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 600, color: COL.text }}>{it.price}</div>
            </div>
          </div>
        ))}
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}

/* ─────────────────────── Minimal ─────────────────────── */

function MinimalFrame() {
  const COL = { bg: "#fff", text: "#111", muted: "#888", border: "#ebebeb" };
  const items = [
    { name: "Avocado Bowl", price: "14,50 €", emoji: "🥗" },
    { name: "Caesar Salad", price: "11,00 €", emoji: "🥬" },
    { name: "Gazpacho", price: "8,00 €", emoji: "🍅" },
  ];
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(0,0,0,0.12)">
      <StatusBar color={COL.text} />
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${COL.border}`, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: COL.text }}>Vorspeisen & Gerichte</div>
      </div>
      <div style={{ display: "flex", gap: 5, padding: "8px 10px", borderBottom: `1px solid ${COL.border}`, overflow: "hidden" }}>
        <div style={{ fontSize: 7, fontWeight: 500, padding: "3px 9px", borderRadius: 999, border: `1px solid ${COL.text}`, background: COL.text, color: "#fff" }}>Naschen</div>
        <div style={{ fontSize: 7, fontWeight: 500, padding: "3px 9px", borderRadius: 999, border: `1px solid ${COL.border}`, color: COL.muted }}>Salate</div>
        <div style={{ fontSize: 7, fontWeight: 500, padding: "3px 9px", borderRadius: 999, border: `1px solid ${COL.border}`, color: COL.muted }}>Fleisch</div>
      </div>
      <div>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderBottom: i < items.length - 1 ? `1px solid ${COL.border}` : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: COL.text, marginBottom: 3 }}>{it.name}</div>
              <div style={{ fontSize: 7, fontWeight: 600, color: COL.text }}>{it.price}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "linear-gradient(135deg, #f0f0f0, #e4e4e4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{it.emoji}</div>
          </div>
        ))}
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}

/* ─────────────────────── Playful (Splash + Items) ─────────────────────── */

function PlayfulSplashFrame() {
  const COL = { bg: "#ffe5f0", white: "#fff", text: "#1a0a12", accent: "#ff3d7f", accent2: "#ffb800" };
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(26,10,18,0.15)">
      <StatusBar color={COL.text} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 12px 0", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, background: "rgba(255,61,127,0.15)", borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%", marginBottom: -18 }} />
        <div style={{ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 26, fontWeight: 800, color: COL.text, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 4 }}>
          bello<span style={{ color: COL.accent }}>!</span>
        </div>
        <div style={{ fontSize: 6, color: "rgba(26,10,18,0.5)", letterSpacing: "0.1em", marginTop: 4, marginBottom: 10 }}>BAR & KÜCHE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "75%" }}>
          {[
            { l: "Dinner", bg: COL.accent, fg: "#fff" },
            { l: "Lunch", bg: COL.white, fg: COL.text },
            { l: "Weine", bg: COL.accent2, fg: COL.text },
          ].map((b, i) => (
            <div key={i} style={{ background: b.bg, color: b.fg, padding: "7px 14px", borderRadius: 999, fontFamily: 'Impact, sans-serif', fontSize: 11, fontWeight: 700, textAlign: "center", boxShadow: `2px 2px 0 ${COL.text}` }}>
              {b.l}
            </div>
          ))}
        </div>
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}

function PlayfulItemsFrame() {
  const COL = { bg: "#ffe5f0", white: "#fff", text: "#1a0a12", accent: "#ff3d7f", muted: "rgba(26,10,18,0.5)" };
  const items = [
    { name: "Burrata", price: "14,50 €", emoji: "🥗" },
    { name: "Cacio e Pepe", price: "16,00 €", emoji: "🍝" },
  ];
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(26,10,18,0.15)">
      <StatusBar color={COL.text} />
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1.5px solid ${COL.text}` }}>
        <div style={{ width: 18, height: 18, borderRadius: 999, background: COL.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, boxShadow: `1.5px 1.5px 0 ${COL.text}` }}>←</div>
        <div style={{ fontFamily: 'Impact, sans-serif', fontSize: 14, fontWeight: 800, color: COL.text, letterSpacing: "-0.02em" }}>Dinner</div>
      </div>
      <div style={{ display: "flex", gap: 5, padding: "6px 10px" }}>
        <div style={{ fontSize: 6, fontWeight: 600, padding: "3px 8px", borderRadius: 999, border: `1.5px solid ${COL.text}`, background: COL.text, color: "#fff" }}>Alle</div>
        <div style={{ fontSize: 6, fontWeight: 600, padding: "3px 8px", borderRadius: 999, border: `1.5px solid ${COL.text}`, color: COL.text }}>Vegan</div>
      </div>
      <div style={{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: COL.white, borderRadius: 10, padding: 6, display: "flex", gap: 7, alignItems: "center", border: `1.5px solid ${COL.text}`, boxShadow: `2px 2px 0 ${COL.text}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: COL.bg, border: `1.5px solid ${COL.text}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{it.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Impact, sans-serif', fontSize: 9, fontWeight: 700, color: COL.text }}>{it.name}</div>
              <div style={{ fontFamily: 'Impact, sans-serif', fontSize: 9, fontWeight: 800, color: COL.text }}>{it.price}</div>
            </div>
          </div>
        ))}
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}

/* ─────────────────────── Asian Dark ─────────────────────── */

function AsianDarkFrame() {
  const COL = { bg: "#0d0d0f", text: "#f0eee8", muted: "rgba(240,238,232,0.4)", accent: "#e8282e", gold: "#c9a84c", border: "rgba(240,238,232,0.07)", card: "rgba(255,255,255,0.04)" };
  const items = [
    { name: "Tonkotsu", jp: "豚骨", price: "15,90 €", emoji: "🍜" },
    { name: "Miso", jp: "辛味噌", price: "14,50 €", emoji: "🌶" },
  ];
  return (
    <PhoneShell bg={COL.bg}>
      <StatusBar />
      <div style={{ padding: "8px 14px 8px", borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 6, letterSpacing: "0.3em", color: COL.accent }}>ラーメン · RAMEN</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: COL.text, letterSpacing: "0.05em", marginTop: 2 }}>Yuki Ramen</div>
        <div style={{ height: 1.5, background: `linear-gradient(90deg, ${COL.accent}, transparent)`, marginTop: 6 }} />
      </div>
      <div style={{ display: "flex", padding: "0 14px", gap: 12 }}>
        <div style={{ fontSize: 7, color: COL.accent, padding: "7px 0", borderBottom: `1.5px solid ${COL.accent}` }}>RAMEN</div>
        <div style={{ fontSize: 7, color: COL.muted, padding: "7px 0" }}>GYOZA</div>
        <div style={{ fontSize: 7, color: COL.muted, padding: "7px 0" }}>SUSHI</div>
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 7, display: "flex", gap: 7, padding: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 5, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{it.emoji}</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 8, fontWeight: 700, color: COL.text }}>{it.name}</div>
                <div style={{ fontSize: 6, color: COL.muted, marginTop: 1 }}>{it.jp}</div>
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, color: COL.gold }}>{it.price}</div>
            </div>
          </div>
        ))}
      </div>
      <HomeIndicator />
    </PhoneShell>
  );
}

/* ─────────────────────── Street Food ─────────────────────── */

function StreetFoodFrame() {
  const COL = { bg: "#111110", bg2: "#1a1a18", text: "#f5f4f0", muted: "rgba(245,244,240,0.45)", border: "rgba(245,244,240,0.08)", accent: "#e8b400", accent2: "#ff4422" };
  return (
    <PhoneShell bg={COL.bg}>
      <StatusBar />
      <div style={{ background: COL.accent, padding: "8px 14px 10px", position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 6, letterSpacing: "0.2em", color: "rgba(0,0,0,0.5)", fontWeight: 600 }}>QRAVE.MENU</div>
        <div style={{ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 22, color: "#111", lineHeight: 0.9, letterSpacing: "0.02em", marginTop: 1 }}>SMASH HAUS</div>
      </div>
      <div style={{ display: "flex", padding: "0 12px", gap: 4, borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 7, fontWeight: 600, color: COL.accent, padding: "8px 6px", borderBottom: `1.5px solid ${COL.accent}` }}>BURGER</div>
        <div style={{ fontSize: 7, fontWeight: 600, color: COL.muted, padding: "8px 6px" }}>SIDES</div>
        <div style={{ fontSize: 7, fontWeight: 600, color: COL.muted, padding: "8px 6px" }}>DRINKS</div>
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ background: COL.bg2, borderRadius: 7, overflow: "hidden", border: `1px solid ${COL.border}` }}>
          <div style={{ height: 56, background: "linear-gradient(135deg, #2a2520, #1a1815)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, position: "relative" }}>
            🍔
            <div style={{ position: "absolute", top: 4, right: 4, fontSize: 6, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: COL.accent2, color: "#fff" }}>HOT</div>
          </div>
          <div style={{ padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: 11, color: COL.text }}>SMASH CLASSIC</span>
            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: 11, color: COL.accent }}>8,90€</span>
          </div>
        </div>
        <div style={{ background: COL.bg2, borderRadius: 7, overflow: "hidden", border: `1px solid ${COL.border}` }}>
          <div style={{ height: 56, background: "linear-gradient(135deg, #2a2520, #1a1815)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🧀</div>
          <div style={{ padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: 11, color: COL.text }}>TRUFFLE</span>
            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: 11, color: COL.accent }}>11,90€</span>
          </div>
        </div>
      </div>
      <HomeIndicator />
    </PhoneShell>
  );
}

/* ─────────────────────── Mediterranean ─────────────────────── */

function MediterraneanFrame() {
  const COL = { bg: "#faf6f0", text: "#2c1a0e", muted: "rgba(44,26,14,0.45)", accent: "#c0580a", accent2: "#5c8a3c", gold: "#c9972a", terracotta: "#d4613a", border: "rgba(44,26,14,0.1)" };
  return (
    <PhoneShell bg={COL.bg} borderColor="rgba(0,0,0,0.12)">
      <div style={{ height: 4, background: `repeating-linear-gradient(90deg, ${COL.terracotta} 0px, ${COL.terracotta} 8px, ${COL.gold} 8px, ${COL.gold} 16px, ${COL.accent2} 16px, ${COL.accent2} 24px, ${COL.gold} 24px, ${COL.gold} 32px)` }} />
      <StatusBar color={COL.text} />
      <div style={{ padding: "6px 14px 10px", textAlign: "center", borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: COL.text, letterSpacing: "0.01em" }}>Bosphorus</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <div style={{ flex: 1, height: 1, background: COL.border }} />
          <span style={{ color: COL.gold, fontSize: 9 }}>✦</span>
          <div style={{ flex: 1, height: 1, background: COL.border }} />
        </div>
      </div>
      <div style={{ display: "flex", padding: "0 14px", gap: 10, borderBottom: `1px solid ${COL.border}` }}>
        <div style={{ fontSize: 7, fontWeight: 600, color: COL.accent, padding: "8px 0", borderBottom: `1.5px solid ${COL.accent}` }}>Mezze</div>
        <div style={{ fontSize: 7, color: COL.muted, padding: "8px 0" }}>Kebab</div>
        <div style={{ fontSize: 7, color: COL.muted, padding: "8px 0" }}>Pide</div>
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { name: "Hummus", price: "7,90 €", emoji: "🥙" },
          { name: "Köfte", price: "13,90 €", emoji: "🥩" },
        ].map((it, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(44,26,14,0.06)", boxShadow: "0 1px 4px rgba(44,26,14,0.06)" }}>
            <div style={{ height: 48, background: "linear-gradient(135deg, #f0e6d8, #e8d8c4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{it.emoji}</div>
            <div style={{ padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 600, color: COL.text }}>{it.name}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: COL.accent }}>{it.price}</span>
            </div>
          </div>
        ))}
      </div>
      <HomeIndicator color="rgba(0,0,0,0.2)" />
    </PhoneShell>
  );
}
