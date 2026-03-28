"use client";

type HeaderProps = {
  restaurantName: string;
  lang: "de" | "en";
  onLangToggle: () => void;
  cartCount: number;
  onCartOpen: () => void;
};

export default function Header({
  restaurantName,
  lang,
  onLangToggle,
  cartCount,
  onCartOpen,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between py-4 gap-3">
          <div className="font-serif font-light tracking-[0.2em] text-[clamp(1.5rem,5vw,2.4rem)] leading-none text-[#1a1916]">
            {restaurantName}<span className="text-[#b8966a]">·</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLangToggle}
              className="rounded-full border border-[#e8e4dc] px-2.5 py-1 text-[0.68rem] font-semibold uppercase text-[#9a948a] hover:border-[#b8966a] hover:text-[#b8966a]"
            >
              {lang === "de" ? "DE" : "EN"}
            </button>
            <button
              type="button"
              onClick={onCartOpen}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-all ${
                cartCount > 0
                  ? "border-[#b8966a] bg-[rgba(184,150,106,0.06)] text-[#b8966a]"
                  : "border-[#e8e4dc] bg-white text-[#1a1916]"
              }`}
            >
              🛒 <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b8966a] text-[0.62rem] font-bold text-white">{cartCount}</span>
            </button>
          </div>
        </div>
  );
}
