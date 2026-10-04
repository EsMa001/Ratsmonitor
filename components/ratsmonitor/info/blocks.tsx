import { useCallback, type ReactNode } from "react";
import { useBrand, useBrandText } from "../lib/brand";
import { useAppNav } from "../state/nav";
import { useSearch } from "../state/search";
import { STATUS_LABEL, type Example, type Qa, type Rich as RichText, type Status } from "./content";
import { Icon, type IconName } from "./icons";
import { IconChevronLeft } from "../components/icons";
import { useRouter } from "next/navigation";

/** Öffnet die echte Suche der Startseite, optional mit vorbelegtem Begriff */
export function useOpenSearch() {
  const { applySearch } = useSearch();
  const { goOverview } = useAppNav();
  return useCallback(
    (term?: string) => {
      if (term) applySearch(term);
      goOverview();
      if (!term) setTimeout(() => document.getElementById("q")?.focus(), 80);
    },
    [applySearch, goOverview],
  );
}

/** Text mit **fett** markierten Stellen */
export function Rich({ text }: { text: RichText }) {
  return (
    <>
      {text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
    </>
  );
}

/** Kopfbereich: graues Icon, türkise Zeile, Seitenname, große Überschrift, Einleitung */
export function PageHead({
  icon,
  label,
  name,
  title,
  lead,
  small,
  aside,
  top,
  children,
}: {
  icon: IconName;
  label: string;
  name: string;
  /** ohne Titel wird der Name zur Überschrift (kompakter Kopf, z. B. Kontoseiten) */
  title?: ReactNode;
  lead?: ReactNode;
  small?: boolean;
  aside?: ReactNode;
  top?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const { goOverview } = useAppNav();
  /* Dezenter Zurück-Pfeil auf allen Info- und Kontoseiten; ohne Vorgeschichte zur Übersicht */
  const back = () => (window.history.length > 1 ? router.back() : goOverview());
  const main = (
    <div>
      <button type="button" onClick={back} className="back-btn -ml-1.5 mb-4">
        <IconChevronLeft />
        Zurück
      </button>
      <div className="ri-bid">
        <Icon name={icon} size={52} className="ri-bid__icon" />
        <div>
          <span className="ri-bid__label">{label}</span>
          {title ? <span className="ri-bid__name">{name}</span> : <h1 className="ri-bid__name m-0">{name}</h1>}
        </div>
      </div>
      {title && <h1 className={"ri-h1" + (small ? " ri-h1--sm" : "")}>{title}</h1>}
      {lead && <p className="ri-lead">{lead}</p>}
      {children}
    </div>
  );
  return (
    <section className={"ri-head" + (title ? "" : " ri-head--compact")}>
      {aside ? (
        <div className={"ri-head__grid" + (top ? " ri-head__grid--top" : "")}>
          {main}
          {aside}
        </div>
      ) : (
        main
      )}
    </section>
  );
}

export function SearchTermButton({ term, light }: { term: string; light?: boolean }) {
  const open = useOpenSearch();
  return (
    <button type="button" className={"ri-btn " + (light ? "ri-btn--inv" : "ri-btn--dark")} onClick={() => open(term)}>
      <Icon name="search" size={15} />
      Nach „{term}“ suchen
    </button>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return <span className={"ri-st ri-st--" + status}>{STATUS_LABEL[status]}</span>;
}

export function PlacePill({ place }: { place: string }) {
  return (
    <span className="ri-place">
      <Icon name="mapPin" size={12} />
      {place}
    </span>
  );
}

/** Dunkle Benachrichtigung über einem Beispiel-Treffer */
export function HitPreview({ term, example }: { term: string; example: Example }) {
  const { name } = useBrand();
  return (
    <div className="ri-pv" aria-label="Beispiel einer Benachrichtigung">
      <div className="ri-pv__note">
        <span className="ri-pv__bell">
          <Icon name="bell" size={15} />
        </span>
        <span>
          <span className="ri-pv__title">Neue Treffer zu „{term}“</span>
          <span className="ri-pv__meta">{name} · gerade eben</span>
        </span>
      </div>
      <div className="ri-pv__card">
        <div className="ri-pv__row">
          <PlacePill place={example.place} />
          <span className="ri-pv__comm">{example.committee}</span>
          <StatusPill status={example.status} />
        </div>
        <p className="ri-pv__h">{example.title}</p>
        <div className="ri-pv__lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      {/* TODO: fiktives Beispiel (Doku Kap. 8), optional durch echte Beispiele ersetzen */}
      <span className="ri-pv__foot">Beispiel mit fiktiven Daten</span>
    </div>
  );
}

/** Dunkler Abschluss: Überschrift, optional Unterzeile oder Suchbegriffe, Knopf rechts */
export function DarkCta({ title, sub, pills, action }: { title: string; sub?: string; pills?: string[]; action: ReactNode }) {
  const open = useOpenSearch();
  return (
    <section className="ri-dark">
      <div className="ri-dark__row">
        <div>
          <h2>{title}</h2>
          {sub && <p className="ri-dark__sub">{sub}</p>}
          {pills && (
            <div className="ri-pills">
              {pills.map((p) => (
                <button key={p} type="button" className="ri-pill" onClick={() => open(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        {action}
      </div>
    </section>
  );
}

/** Aufklappbare Frage mit Plus/Minus rechts */
export function QaItem({ qa }: { qa: Qa }) {
  const brandText = useBrandText();
  return (
    <details className="ri-qa">
      <summary>
        {brandText(qa.q)}
        <Icon name="plus" size={22} className="ri-qa__sign ri-qa__sign--plus" />
        <Icon name="minus" size={22} className="ri-qa__sign ri-qa__sign--minus" />
      </summary>
      {qa.a ? <p className="ri-qa__a">{brandText(qa.a)}</p> : <p className="ri-qa__a ri-qa__a--todo">Antwort folgt.</p>}
    </details>
  );
}
