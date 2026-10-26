import Link from "next/link";
import { useMe } from "../lib/account";
import { priceLabel, UPGRADE_TEXT } from "../lib/tier";

/**
 * Hinweis auf Plus für die Startseite: nur für Gäste und kostenlose Konten, erst wenn /api/me geantwortet hat (Plus-Nutzer
 * sehen ihn nie, auch nicht kurz). Vorteile nach docs/produkt/vorteile.json (Rang 3, 7/8, 11), dazu die eigene Treffergrenze.
 */
export function PlusHint() {
  const me = useMe();
  if (!me.ready || !me.accounts || me.tier === "pro" || me.tier === "enterprise") return null;
  const max = me.limits.maxResults;
  const points = [
    Number.isFinite(max) ? `Alle Treffer statt ${max} je Suche` : "Alle Treffer",
    "E-Mail-Alarm, auch sofort, statt täglich selbst suchen",
    "plenara.X: sehen, wo etwas passiert und wie es sich ausbreitet",
    "Sitzungskalender mit Abo: keine Sitzung verpassen",
  ];
  return (
    <aside aria-labelledby="plus-hint-title" className="pl-plus mt-7 max-w-[460px] border-t border-[var(--rm-c200)] pt-5">
      <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span id="plus-hint-title" className="text-[16px] font-semibold text-[var(--rm-c900)]">
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
        <Link href="/kontakt" className="inline-flex min-h-11 items-center gap-1.5 text-teal-700 no-underline after:content-['→'] after:transition-transform hover:after:translate-x-0.5">
          {UPGRADE_TEXT}
        </Link>
        <Link href="/preise" className="inline-flex min-h-11 items-center text-[var(--rm-c500)] underline-offset-2 hover:underline">
          Stufen vergleichen
        </Link>
      </p>
    </aside>
  );
}
