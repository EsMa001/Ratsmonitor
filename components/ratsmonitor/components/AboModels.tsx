import Link from "next/link";
import { usePlusLink, type Bookable } from "../lib/booking";
import { LIMITS, priceLabel, TIER_LABEL } from "../lib/tier";

/** Was die Abo-Modelle bringen, in einem Satz (Zahlen aus shared/plans.mjs) */
const NUTZEN: Record<Bookable, string> = {
  plus: `Alle Treffer, plenara.X, je ${LIMITS.plus.savedSearches} Suchen und Artikel, Wochenbericht, Kalender mit ${LIMITS.plus.calendarAreas} Gebieten.`,
  pro: "Alles unbegrenzt, Dokumentsuche, E-Mails je Suche bis täglich.",
};

/**
 * Hinweis auf die Abo-Modelle, überall gleich: Startseite (ohne Konto und mit kostenlosem Konto, PlusHint), an jeder Grenze
 * (GateDialog, Trefferliste, gesperrte plenara.X-Seiten). Je Modell Name, Preis, Nutzen und derselbe Buchungsknopf (zur
 * Buchungsseite, ohne Bezahlung zur Anfrage). only: nur die Modelle, die die Grenze heben (Plus-Kunden: nur Pro).
 */
export function AboModels({ only, onPick, className = "" }: { only?: Bookable[]; /** z. B. Dialog schließen */ onPick?: () => void; className?: string }) {
  const links: Record<Bookable, ReturnType<typeof usePlusLink>> = { plus: usePlusLink("plus"), pro: usePlusLink("pro") };
  const tiers = only ?? (["plus", "pro"] as Bookable[]);
  return (
    <div className={className}>
      <ul className="m-0 list-none p-0">
        {tiers.map((t) => {
          const link = links[t];
          return (
            <li key={t} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--rm-c200)] py-3 first:border-t-0 first:pt-0">
              <span className="text-[16px] font-semibold text-[var(--rm-c900)]">{TIER_LABEL[t]}</span>
              <span className="text-[14px] text-[var(--rm-c500)]">{priceLabel(t)}</span>
              <span className="basis-full text-[14px] leading-snug text-[var(--rm-c500)]">{NUTZEN[t]}</span>
              <Link
                href={link.href}
                onClick={onPick}
                className="mt-1 inline-flex h-9 items-center gap-2 rounded-full bg-teal-700 px-4 text-[14px] font-medium text-white no-underline after:content-['→'] hover:opacity-85"
              >
                {link.book ? link.label : `${TIER_LABEL[t]}: ${link.label}`}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-2 text-[14px] text-[var(--rm-c500)]">
        Monatlich kündbar.{" "}
        <Link href="/preise" onClick={onPick} className="text-teal-700 no-underline hover:underline">
          Stufen vergleichen
        </Link>
      </p>
    </div>
  );
}
