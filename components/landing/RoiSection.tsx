type StatCard = {
  /** Große Stat oben — z. B. "+30%" oder "75%" */
  stat: string;
  /** Untertitel kurz, eine Zeile */
  label: string;
  /** Erklärungstext, 1–2 Sätze */
  body: string;
};

const CARDS: StatCard[] = [
  {
    stat: "+30%",
    label: "Mehr Umsatz",
    body:
      "Menüs mit Fotos steigern den Umsatz um bis zu 30%. Gäste bestellen was sie sehen.",
  },
  {
    stat: "+20%",
    label: "Dessertumsatz",
    body:
      "Digitale Karten steigern den Dessert- und Aperitif-Umsatz nachweislich. Belegt durch Chili's/Ziosk (SEC-validiert).",
  },
  {
    stat: "10–15 Min.",
    label: "Pro Tisch gespart",
    body:
      "Weniger Wartezeit, schnellerer Service, mehr Tischsitzungen pro Abend.",
  },
  {
    stat: "−30%",
    label: "Bestellfehler",
    body:
      "Kein Verlesen, kein Missverständnis. Der Gast bestellt selbst was er will.",
  },
  {
    stat: "75%",
    label: "Wählen nach Fotos",
    body:
      "75% der Gäste entscheiden sich für ein Restaurant wegen der Fotos. Zeig deine Gerichte von ihrer besten Seite.",
  },
];

export default function RoiSection() {
  return (
    <section className="roi-section" aria-label="Was du wirklich davon hast">
      <div className="roi-wrap">
        <span className="roi-label">Was du wirklich davon hast</span>
        <div className="roi-head">
          <h2>Dein Restaurant verdient mehr</h2>
          <p>
            Belegte Zahlen aus der Gastronomie — nicht aus dem Marketing-Deck.
          </p>
        </div>

        <div className="roi-grid">
          {CARDS.map((c, i) => (
            <article
              key={c.label}
              className={`roi-card${i === 0 ? " roi-card-hero" : ""}`}
            >
              <div className="roi-stat" aria-hidden>{c.stat}</div>
              <div className="roi-card-label">{c.label}</div>
              <p className="roi-card-body">{c.body}</p>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        .roi-section {
          position: relative;
          padding: 120px 0;
          background: #06040e;
          overflow: hidden;
          isolation: isolate;
        }
        .roi-section::before {
          content: "";
          position: absolute;
          top: -180px;
          left: -160px;
          width: 560px;
          height: 560px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(147, 51, 234, 0.28),
            transparent 65%
          );
          pointer-events: none;
          z-index: 0;
        }
        .roi-section::after {
          content: "";
          position: absolute;
          bottom: -240px;
          right: -200px;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(124, 58, 237, 0.16),
            transparent 65%
          );
          pointer-events: none;
          z-index: 0;
        }
        .roi-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 1;
        }
        .roi-label {
          font-family: var(--font-roboto), "Roboto", system-ui, sans-serif;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #a855f7;
          display: block;
          text-align: center;
          margin-bottom: 14px;
        }
        .roi-head {
          text-align: center;
          margin-bottom: 56px;
        }
        .roi-head h2 {
          font-family: var(--font-roboto), "Roboto", system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(30px, 4vw, 46px);
          letter-spacing: -0.03em;
          line-height: 1.1;
          max-width: 22ch;
          margin: 0 auto;
          color: #ffffff;
          text-wrap: balance;
        }
        .roi-head p {
          font-family: var(--font-dm-sans), "DM Sans", system-ui, sans-serif;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
          margin: 16px auto 0;
          max-width: 48ch;
          line-height: 1.55;
        }
        .roi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        @media (min-width: 768px) {
          .roi-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 22px;
          }
        }
        @media (min-width: 1100px) {
          .roi-grid {
            grid-template-columns: repeat(6, 1fr);
          }
          .roi-card-hero {
            grid-column: span 2;
          }
          .roi-card {
            grid-column: span 2;
          }
          .roi-grid > :nth-child(4),
          .roi-grid > :nth-child(5) {
            grid-column: span 3;
          }
        }
        .roi-card {
          position: relative;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(147, 51, 234, 0.2);
          border-radius: 16px;
          padding: 28px 22px 24px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: transform 0.25s ease, border-color 0.25s ease,
            box-shadow 0.25s ease;
        }
        .roi-card:hover {
          transform: translateY(-3px);
          border-color: rgba(147, 51, 234, 0.4);
          box-shadow: 0 18px 40px -20px rgba(147, 51, 234, 0.45);
        }
        .roi-card-hero {
          border-color: rgba(147, 51, 234, 0.32);
          background: linear-gradient(
              160deg,
              rgba(147, 51, 234, 0.08),
              rgba(255, 255, 255, 0.04) 60%
            );
        }
        .roi-stat {
          font-family: var(--font-roboto), "Roboto", system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(36px, 4.5vw, 52px);
          letter-spacing: -0.04em;
          line-height: 1;
          background: linear-gradient(135deg, #9333ea 0%, #c4b5fd 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          margin-bottom: 10px;
        }
        .roi-card-label {
          font-family: var(--font-roboto), "Roboto", system-ui, sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #ffffff;
          margin-bottom: 12px;
        }
        .roi-card-body {
          font-family: var(--font-dm-sans), "DM Sans", system-ui, sans-serif;
          font-size: 14.5px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.62);
          margin: 0;
        }
        @media (max-width: 640px) {
          .roi-section {
            padding: 80px 0;
          }
          .roi-head {
            margin-bottom: 40px;
          }
          .roi-card {
            padding: 22px 18px 20px;
          }
        }
      `}</style>
    </section>
  );
}
