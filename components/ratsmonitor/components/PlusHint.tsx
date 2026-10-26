import Link from "next/link";
import { useState } from "react";
import { useMe } from "../lib/account";
import { priceLabel, UPGRADE_TEXT } from "../lib/tier";
import { useClient } from "../lib/useClient";

/** Ausgeblendet per × (nur dieser Browser, 14 Tage) */
const CLOSED_KEY = "ratsmonitor:plus-hint-closed:v1";
const CLOSED_MS = 14 * 86400000;
const closedNow = () => {
  try {
    const at = Number(localStorage.getItem(CLOSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < CLOSED_MS;
  } catch {
    return false;
  }
};

/**
 * Hinweis auf Plus für die Startseite: nur für Gäste und kostenlose Konten, erst wenn /api/me geantwortet hat (Plus-Nutzer
 * sehen ihn nie, auch nicht kurz). Vorteile nach docs/produkt/vorteile.json (Rang 3, 7/8, 11), dazu die eigene Treffergrenze.
 * placement "map": Overlay unten rechts auf der Karte (Desktop, Milchglas, mit ×); "inline": unter dem Startknopf (Handy).
 * Welche Fassung zu sehen ist, entscheidet info.css (`.pl-plus--map` / `.pl-plus--inline`).
 */
export function PlusHint({ placement }: { placement: "map" | "inline" }) {
  const me = useMe();
  const stored = useClient(closedNow, false);
  const [closed, setClosed] = useState(false);
  if (!me.ready || !me.accounts || me.tier === "pro" || me.tier === "enterprise" || stored || closed) return null;
  const max = me.limits.maxResults;
  const points = [
    Number.isFinite(max) ? `Alle Treffer statt ${max} je Suche` : "Alle Treffer",
    "E-Mail-Alarm, auch sofort, statt täglich selbst suchen",
    "plenara.X: sehen, wo etwas passiert und wie es sich ausbreitet",
    "Sitzungskalender mit Abo: keine Sitzung verpassen",
  ];
  const map = placement === "map";
  const close = () => {
    try {
      localStorage.setItem(CLOSED_KEY, String(Date.now()));
    } catch {
      /* ohne Speicher nur für diesen Besuch */
    }
    setClosed(true);
  };
  return (
    <aside
      aria-labelledby={`plus-hint-${placement}`}
      className={map ? "pl-plus pl-plus--map rm-glass absolute bottom-[3%] right-0 z-10 w-[340px] max-w-[calc(100%-1rem)] rounded-2xl p-4 pr-10" : "pl-plus pl-plus--inline mt-7 max-w-[460px] border-t border-[var(--rm-c200)] pt-5"}
    >
      {map && (
        <button type="button" onClick={close} aria-label="Hinweis auf Plus ausblenden" className="absolute right-1.5 top-1.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[18px] leading-none text-[var(--rm-c500)] hover:text-[var(--rm-c900)]">
          ×
        </button>
      )}
      <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span id={`plus-hint-${placement}`} className={`${map ? "text-[18px]" : "text-[16px]"} font-semibold text-[var(--rm-c900)]`}>
          Mehr mit Plus
        </span>
        <span className="text-[14px] text-[var(--rm-c500)]">{priceLabel("pro")} · monatlich kündbar</span>
      </p>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0 text-[14px] text-[var(--rm-c900)]">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden="true" className="text-teal-700">✓</span>
            {p}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] font-medium">
        <Link
          href="/kontakt"
          className={map ? "inline-flex h-11 items-center gap-2 rounded-full bg-teal-700 px-5 text-white no-underline after:content-['→'] hover:opacity-85" : "inline-flex min-h-11 items-center gap-1.5 text-teal-700 no-underline after:content-['→'] after:transition-transform hover:after:translate-x-0.5"}
        >
          {UPGRADE_TEXT}
        </Link>
        <Link href="/preise" className="inline-flex min-h-11 items-center text-[var(--rm-c500)] underline-offset-2 hover:underline">
          Stufen vergleichen
        </Link>
      </p>
    </aside>
  );
}
