import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { BRANCHEN } from "../info/content";
import { Icon } from "../info/icons";
import { useMe } from "../lib/account";
import { IconChevronDown } from "../components/icons";
import { AnalyticsX } from "../components/Brand";

/* Unterpunkte von „Funktionen“: Erklärseiten (Suche, Benachrichtigungen) und die Arbeitsbereiche */
const FUNKTIONEN: { href: string; label: string; icon: "search" | "heart" | "bell" | "calendar" | "fileText" | "circleHelp" }[] = [
  { href: "/suche", label: "Suche", icon: "search" },
  { href: "/konto/suchen", label: "Gespeicherte Suchen", icon: "heart" },
  { href: "/konto/artikel", label: "Gespeicherte Artikel", icon: "fileText" },
  { href: "/funktionen/benachrichtigungen", label: "Benachrichtigungen", icon: "bell" },
  { href: "/konto/kalender", label: "Kalender", icon: "calendar" },
];

/* Unterpunkte von „Informationen“: Tarife, Videos, Datenabdeckung und häufige Fragen */
/* Anwender: fünf Gruppen, jede mit den Branchenseiten, die dazu gehören */
/* Anwender: genau diese fünf Seiten, jede führt auf ihre Hauptbranche */
const ANWENDER: { label: string; slug: string; icon?: "map" }[] = [
  { label: "Immobilien", slug: "immobilien" },
  { label: "Versorgung", slug: "versorgung" },
  { label: "Planung", slug: "planung", icon: "map" },
  { label: "Verbände", slug: "verbaende" },
  { label: "Öffentlichkeit", slug: "oeffentlichkeit" },
];/* Analyse: Start (Übersicht), Signale (was entsteht), Tools (alle Werkzeuge), Atlas (worüber beraten wird); die einzelnen Analysen stehen auf diesen Seiten */
/* plenara.X (Logo als Gruppenname) mit zwei Abschnitten: Analysen (die vier Seiten) und Einblicke, je Eintrag die Frage leise rechts daneben */
type XEintrag = { href: string; label: string; icon: "map" | "zap" | "trendingUp" | "layoutGrid" | "users" | "landmark" | "network" | "newspaper"; hint?: string };
const ANALYSE: XEintrag[] = [
  { href: "/analytics/atlas", label: "Atlas", icon: "map", hint: "Wie viel?" },
  { href: "/analytics/signale", label: "Signale", icon: "zap", hint: "Was entsteht?" },
  { href: "/analytics/trends", label: "Trends", icon: "trendingUp", hint: "Was verändert sich?" },
  { href: "/analytics/fakten", label: "Fakten", icon: "map", hint: "Welcher Wert?" },
];
/* Einblicke: wer beteiligt ist und was zusammenhängt (die früheren Tools; Ortsvergleich und Beschlüsse sind Reiter in Atlas und Trends) */
const EINBLICKE: XEintrag[] = [
  { href: "/analytics/fraktionen", label: "Fraktionen", icon: "landmark", hint: "Wer will was?" },
  { href: "/analytics/gremien", label: "Gremien", icon: "users", hint: "Wer berät was?" },
  { href: "/analytics/graph", label: "Themennetz", icon: "network", hint: "Was hängt zusammen?" },
  { href: "/analytics/news", label: "News", icon: "newspaper", hint: "Was ist diese Woche?" },
];

const INFO: { href: string; label: string; icon: "euro" | "circlePlay" | "layers" | "circleHelp" }[] = [
  { href: "/preise", label: "Preise", icon: "euro" },
  { href: "/videos", label: "Videos", icon: "circlePlay" },
  { href: "/datenabdeckung", label: "Datenabdeckung", icon: "layers" },
  { href: "/faq", label: "FAQ", icon: "circleHelp" },
];

/** Dreistrichmenü: Knopf in der Kopfzeile, Auswahl klappt links unterhalb der Kopfzeile auf und braucht nur so viel Platz wie nötig */
/** Abstand des Menüfensters zur Kopfzeile (klein gehalten) */
const MENU_GAP = 6;

export function MainMenu() {
  /* "all" = Dreistrichmenü; "funktionen"/"usecases" = Aufklappliste der breiten Kopfzeile */
  const [open, setOpen] = useState<false | "all" | "funktionen" | "analyse" | "usecases" | "info">(false);
  const [pos, setPos] = useState({ top: 60, left: 8 });
  const path = usePathname();
  const me = useMe();
  /* Eingeklappt starten; die Gruppe der aktuellen Seite ist offen */
  const [openGroup, setOpenGroup] = useState(() => (path.startsWith("/anwender/") ? "usecases" : path.startsWith("/analytics") ? "analyse" : ["/preise", "/videos", "/datenabdeckung", "/faq"].includes(path) ? "info" : path.startsWith("/funktionen/") || path.startsWith("/konto/") ? "funktionen" : ""));
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  /* Seitenwechsel (z. B. über die Symbole rechts) schließt das Menü */
  const [openedAt, setOpenedAt] = useState(path);
  if (openedAt !== path) {
    setOpenedAt(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    /* Klick in die Kopfzeile außerhalb des Menüs (Logo, Herz, Kalender …) schließt es; die Kopfzeile liegt über dem Hintergrund */
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || (t instanceof Element && t.closest("[data-menu-trigger]"))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    /* Fokus auf das Menü selbst, nicht auf den ersten Eintrag: sonst sähe „Suche“ wie ausgewählt aus */
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  /* Fokus bleibt im geöffneten Menü */
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = panelRef.current.querySelectorAll<HTMLElement>("a[href], button");
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* Nach Auswahl schließt das Menü und die Seite beginnt oben */
  const pick = () => {
    close();
    window.scrollTo(0, 0);
  };
  const toggle = (which: "all" | "funktionen" | "analyse" | "usecases" | "info", el: HTMLElement | null) => {
    if (open === which) return close();
    const btn = el?.getBoundingClientRect();
    const head = btnRef.current?.closest("header")?.getBoundingClientRect();
    setPos({ top: Math.max(0, Math.round((head?.bottom ?? 52) + MENU_GAP)), left: Math.max(8, Math.round(btn?.left ?? 8)) });
    setOpen(which);
  };
  const show = (g: string) => (open === "all" ? openGroup === g : open === g);
  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <>
      <button ref={btnRef} type="button" data-menu-trigger className="ri-burger xl:!hidden" aria-label={open === "all" ? "Menü schließen" : "Menü öffnen"} aria-expanded={open === "all"} aria-controls="hauptmenue" onClick={(e) => toggle("all", e.currentTarget)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6.5h16M4 12h12M4 17.5h8" />
        </svg>
      </button>
      {/* Breite Bildschirme: Menüpunkte direkt in der Kopfzeile, Funktionen und Use Cases klappen auf */}
      <nav aria-label="Hauptmenü" className="ri-topnav order-last hidden xl:flex">
        {(["usecases", "funktionen", "analyse", "info"] as const).map((g) => (
          <button key={g} type="button" data-menu-trigger aria-expanded={open === g} aria-controls="hauptmenue" onClick={(e) => toggle(g, e.currentTarget)}>
            {g === "funktionen" ? "Funktionen" : g === "analyse" ? <AnalysenBy /> : g === "usecases" ? "Anwender" : "Informationen"}
            <IconChevronDown size={14} className={open === g ? "rotate-180" : ""} />
          </button>
        ))}
      </nav>
      {open &&
        createPortal(
          <div className="ri-menu">
            <div className="ri-menu__bg" onClick={close} aria-hidden="true" />
            <div ref={panelRef} id="hauptmenue" tabIndex={-1} className={`ri-menu__panel outline-none ${open !== "all" ? "ri-menu__panel--flyout" : ""}`} role="dialog" aria-label="Hauptmenü" style={{ top: pos.top, left: pos.left, maxHeight: `calc(100dvh - ${pos.top}px - 12px)` }} onKeyDown={trap}>
              {/* Gleiche Gruppen wie in der Fußzeile; Linien statt Kästen. Gespeichertes und Konto erreicht man über die Icons in der Kopfzeile */}
              <nav className="ri-menu__nav" aria-label="Menü">
                {/* Funktionen und Use Cases sind einklappbar; die Gruppen selbst sind keine Seiten */}
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "usecases"} onClick={() => setOpenGroup(openGroup === "usecases" ? "" : "usecases")}>
                  Anwender
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "usecases" ? "rotate-180" : ""}`} />
                </button>}
                {show("usecases") && (
                  <ul className="ri-menu__subs">
                    {ANWENDER.map((g) => {
                      const b = BRANCHEN.find((x) => x.slug === g.slug);
                      const href = `/anwender/${g.slug}`;
                      return (
                        <li key={g.slug}>
                          <Link href={href} className="ri-menu__sub" aria-current={current(href)} onClick={pick}>
                            <Icon name={g.icon ?? b?.icon ?? "fileText"} size={15} />
                            {g.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "funktionen"} onClick={() => setOpenGroup(openGroup === "funktionen" ? "" : "funktionen")}>
                  Funktionen
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "funktionen" ? "rotate-180" : ""}`} />
                </button>}
                {show("funktionen") && (
                  <ul className="ri-menu__subs">
                    {FUNKTIONEN.map((f) => (
                      <li key={f.href}>
                        <Link href={f.href} className="ri-menu__sub" aria-current={current(f.href)} onClick={pick}>
                          <Icon name={f.icon} size={15} />
                          {f.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "analyse"} onClick={() => setOpenGroup(openGroup === "analyse" ? "" : "analyse")}>
                  <AnalysenBy />
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "analyse" ? "rotate-180" : ""}`} />
                </button>}
                {show("analyse") && (
                  <ul className="ri-menu__subs">
                    {([["Analysen", ANALYSE], ["Einblicke", EINBLICKE]] as const).map(([name, list]) => (
                      <li key={name}>
                        <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{name}</div>
                        <ul>
                          {list.map((f) => (
                            <li key={f.href}>
                              <Link href={f.href} className="ri-menu__sub min-w-[250px]" aria-current={current(f.href)} onClick={pick}>
                                <Icon name={f.icon} size={15} />
                                <span>{f.label}</span>
                                {f.hint && <span className="ml-auto pl-4 text-[12px] font-normal text-slate-400">{f.hint}</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "info"} onClick={() => setOpenGroup(openGroup === "info" ? "" : "info")}>
                  Informationen
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "info" ? "rotate-180" : ""}`} />
                </button>}
                {show("info") && (
                  <ul className="ri-menu__subs">
                    {INFO.map((f) => (
                      <li key={f.href}>
                        <Link href={f.href} className="ri-menu__sub" aria-current={current(f.href)} onClick={pick}>
                          <Icon name={f.icon} size={15} />
                          {f.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>
              {open === "all" && me.ready && me.accounts && !me.user && (
                <div className="ri-menu__start">
                  <Link href="/anmelden" className="btn-secondary w-full" onClick={pick}>
                    Anmelden
                  </Link>
                  <p>Suchen speichern und Beschlüsse merken.</p>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Name der Gruppe: das Logo plenara.X als Schriftzug (über den Abschnitten Analysen und Einblicke) */
function AnalysenBy() {
  /* Fließtext in einer Zeile: alle Wörter auf derselben Grundlinie und in derselben Größe, das X mit vertical-align: middle auf
     der halben x-Höhe, also auf der Mittellinie der Kleinbuchstaben */
  return <span className="whitespace-nowrap">
    <span aria-label="plenara.X" role="img"><span className="text-slate-900" style={{ letterSpacing: "-.015em" }}>plenara</span><span className="inline-block align-middle" style={{ fontSize: "1em", lineHeight: 0 }}><AnalyticsX centered /></span></span></span>;
}
