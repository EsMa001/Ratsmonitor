import { useState } from "react";
import { useMe } from "../lib/account";
import { rankOf } from "../lib/tier";
import { AboModels } from "./AboModels";

/**
 * Hinweis auf die Abo-Modelle für die Startseite: nur ohne Konto und mit dem kostenlosen Konto, erst wenn /api/me geantwortet
 * hat (Plus- und Pro-Kunden sehen ihn nie, auch nicht kurz). × blendet ihn nur für diesen Aufruf aus; beim nächsten Aufruf der
 * Startseite ist er wieder da (nichts im Browser gespeichert). Inhalt wie an jeder Grenze: AboModels (Plus und Pro).
 * placement "map": Overlay unten an der Karte, am rechten Rand der Kartenspalte (`.pl-mapcol`) (Desktop, Milchglas, mit ×); "inline": unter dem Startknopf (Handy).
 * Welche Fassung zu sehen ist, entscheidet info.css (`.pl-plus--map` / `.pl-plus--inline`).
 */
export function PlusHint({ placement }: { placement: "map" | "inline" }) {
  const me = useMe();
  const [closed, setClosed] = useState(false);
  if (!me.ready || !me.accounts || rankOf(me.tier) >= rankOf("plus") || closed) return null;
  const max = me.limits.maxResults;
  const map = placement === "map";
  const close = () => setClosed(true);
  return (
    <aside
      aria-labelledby={`plus-hint-${placement}`}
      className={map ? "pl-plus pl-plus--map rm-glass absolute bottom-[3%] right-0 z-10 w-[400px] max-w-[calc(100%-1rem)] rounded-2xl p-4 pr-10" : "pl-plus pl-plus--inline mt-7 max-w-[460px] border-t border-[var(--rm-c200)] pt-5"}
    >
      {map && (
        <button type="button" onClick={close} aria-label="Hinweis auf die Abo-Modelle ausblenden" className="absolute right-1.5 top-1.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[18px] leading-none text-[var(--rm-c500)] hover:text-[var(--rm-c900)]">
          ×
        </button>
      )}
      <p id={`plus-hint-${placement}`} className={`m-0 ${map ? "text-[18px]" : "text-[16px]"} font-semibold text-[var(--rm-c900)]`}>
        Mehr mit einem Abo
      </p>
      <p className="m-0 mt-1 text-[14px] text-[var(--rm-c500)]">
        {Number.isFinite(max) ? `Sie sehen ${max} Treffer je Suche. ` : ""}Mit Plus oder Pro sehen Sie alle und bekommen neue Treffer per E-Mail.
      </p>
      <AboModels className="mt-3" />
    </aside>
  );
}
