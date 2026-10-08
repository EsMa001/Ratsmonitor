import { useCallback, type ReactNode } from "react";
import { StepTimeline } from "../components/results/ArticleCard";
import { useBrand, useBrandText } from "../lib/brand";
import { useAppNav } from "../state/nav";
import { useSearch } from "../state/search";
import { STATUS_LABEL, type Example, type Qa, type Rich as RichText, type Status } from "./content";
import { Icon, type IconName } from "./icons";
import { IconChevronLeft } from "../components/icons";
import { Reveal } from "../pages/analytics/Reveal";
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
  /* Überall wie ein vorausgefülltes Suchfeld: zeigt direkt, was passiert, und sieht aus wie die echte Suche.
     light (im Abschluss): etwas breiter, damit es neben dem Text ausgewogen wirkt */
  return (
    <button
      type="button"
      onClick={() => open(term)}
      aria-label={`Nach „${term}“ suchen`}
      className={`group flex h-12 w-full items-center gap-3 rounded-xl bg-white pl-4 pr-3 text-left shadow-card transition-shadow hover:shadow-pop ${light ? "max-w-[380px] sm:w-[380px]" : "max-w-[440px]"}`}
    >
      <Icon name="search" size={18} className="flex-none text-slate-500" />
      <span className="min-w-0 flex-1 truncate text-[16px] text-slate-900">{term}</span>
      <span className="flex-none text-[14px] text-teal-600">Suchen <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span></span>
    </button>
  );
}

export function StatusPill({ status }: { status: Status }) {
  /* Stand als schlichter grauer Text (keine bunten Abzeichen) */
  return <span style={{ fontSize: 12, color: "var(--rm-c500,#64748b)", whiteSpace: "nowrap" }}>{STATUS_LABEL[status]}</span>;
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
export function HitPreview({ term, example, topics, active, onPick }: { term: string; example: Example; topics?: string[]; active?: number; onPick?: (i: number) => void }) {
  const { name } = useBrand();
  const openSearch = useOpenSearch();
  return (
    <Reveal delay={150}>
    <div className="ri-pv" aria-label="Beispiel eines echten Treffers" style={{ background: "none", border: "none", boxShadow: "none", padding: 0, marginTop: 24 }}>
      <a href={example.href ?? undefined} aria-label={example.title} className="group" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
      <div className="ri-pv__card transition-transform duration-300 group-hover:-translate-y-1" style={{ background: "linear-gradient(135deg, var(--rm-white,#ffffff) 0%, #f1fbf9 100%)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", gap: 12 }}>
          {example.datum && (
            <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", borderRight: "1px solid var(--rm-c200,#e2e8f0)", paddingRight: 10, textAlign: "center" }}>
              <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{example.datum[0]}</span>
              <span style={{ marginTop: 4, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: "#0d9488" }}>{example.datum[1]}</span>
              <span style={{ fontSize: 12, color: "var(--rm-c500,#64748b)" }}>{example.datum[2]}</span>
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <PlacePill place={example.place} />
              <span style={{ fontSize: 13, color: "var(--rm-c500,#64748b)" }}>{example.committee}</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--rm-c900,#0f172a)" }}>{example.title}</p>
            {example.steps && <div style={{ marginTop: 10 }}><StepTimeline steps={example.steps} /></div>}
          </div>
        </div>
      </div>
      </a>
      {topics && (
        <div style={{ marginTop: 16 }}>
          <span className="ri-pv__topics-label" style={{ display: "block", marginBottom: 8 }}>Auch im Blick</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {topics.map((t, i) => (
            <button key={t + i} type="button" aria-pressed={active === i} onClick={() => (onPick ? onPick(i) : openSearch(t))} className={"rounded-full border px-3 py-1.5 text-[13px] " + (active === i ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-600")}>{t}</button>
          ))}
          </div>
        </div>
      )}
      <span className="ri-pv__foot">Echter Treffer aus dem Bestand</span>
    </div>
    </Reveal>
  );
}

/** Dunkler Abschluss: Überschrift, optional Unterzeile oder Suchbegriffe, Knopf rechts */
export function DarkCta({ title, sub, pills, action }: { title: string; sub?: string; pills?: string[]; action?: ReactNode }) {
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
                /* Kleine Such-Buttons im Stil des vorausgefüllten Suchfelds */
                <button key={p} type="button" aria-label={`Nach „${p}“ suchen`} className="group flex h-10 items-center gap-2 rounded-lg bg-white pl-3 pr-2.5 text-left shadow-card transition-shadow hover:shadow-pop" onClick={() => open(p)}>
                  <Icon name="search" size={15} className="flex-none text-slate-500" />
                  <span className="text-[14px] text-slate-900">{p}</span>
                  <span className="text-[14px] text-teal-600 transition-transform group-hover:translate-x-0.5">→</span>
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
