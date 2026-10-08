import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { BRANCHEN } from "../info/content";
import { Icon } from "../info/icons";
import { useTier } from "../lib/tier";
import { IconChevronDown } from "../components/icons";

/* Unterpunkte von „Funktionen“: Erklärseiten (Suche, Benachrichtigungen) und die Arbeitsbereiche */
const FUNKTIONEN: { href: string; label: string; icon: "search" | "heart" | "bell" | "calendar" | "fileText" }[] = [
  { href: "/funktionen/suche", label: "Suche", icon: "search" },
  { href: "/konto/suchen", label: "Gespeicherte Suchen", icon: "heart" },
  { href: "/konto/artikel", label: "Gespeicherte Artikel", icon: "fileText" },
  { href: "/funktionen/benachrichtigungen", label: "Benachrichtigungen", icon: "bell" },
  { href: "/konto/kalender", label: "Kalender", icon: "calendar" },
];

/* Unterpunkte von „Plenara.X“ (die Gruppe selbst ist keine Seite) */
const ANALYTICS: { href: string; label: string; icon: "fileText" | "map" | "network" | "trendingUp" | "mapPin" | "circleCheck" | "users" }[] = [
  { href: "/analytics/ueber", label: "Über Plenara.X", icon: "fileText" },
  { href: "/analytics/diffusion", label: "Diffusionsanalyse", icon: "map" },
  { href: "/analytics/graph", label: "Knowledge Graph", icon: "network" },
  { href: "/analytics/trends", label: "Trends und Frühindikatoren", icon: "trendingUp" },
  { href: "/analytics/vergleich", label: "Gebietsvergleich", icon: "mapPin" },
  { href: "/analytics/beschluesse", label: "Status und Beschlüsse", icon: "circleCheck" },
  { href: "/analytics/gremien", label: "Gremiennetz", icon: "users" },
];

/* Unterpunkte von „Entdecken“: Tarife, Videos, Datenabdeckung und häufige Fragen */
const INFO: { href: string; label: string; icon: "euro" | "circlePlay" | "layers" | "circleHelp" }[] = [
  { href: "/preise", label: "Preise", icon: "euro" },
  { href: "/videos", label: "Videos", icon: "circlePlay" },
  { href: "/quellen", label: "Datenabdeckung", icon: "layers" },
  { href: "/faq", label: "FAQ", icon: "circleHelp" },
];

/** Dreistrichmenü: Knopf in der Kopfzeile, Auswahl klappt links unterhalb der Kopfzeile auf und braucht nur so viel Platz wie nötig */
/** Abstand des Menüfensters zur Kopfzeile (klein gehalten) */
const MENU_GAP = 6;

export function MainMenu() {
  /* "all" = Dreistrichmenü; "funktionen"/"usecases" = Aufklappliste der breiten Kopfzeile */
  const [open, setOpen] = useState<false | "all" | "funktionen" | "usecases" | "analytics" | "info">(false);
  const [pos, setPos] = useState({ top: 60, left: 8 });
  const path = usePathname();
  const { tier } = useTier();
  /* Eingeklappt starten; die Gruppe der aktuellen Seite ist offen */
  const [openGroup, setOpenGroup] = useState(() => (path.startsWith("/branchen/") ? "usecases" : path.startsWith("/analytics") ? "analytics" : ["/preise", "/videos", "/quellen", "/faq"].includes(path) ? "info" : path.startsWith("/funktionen/") || path.startsWith("/konto/") ? "funktionen" : ""));
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  /* Seitenwechsel (z. B. über die Symbole rechts) schließt das Menü */
  useEffect(() => setOpen(false), [path]);

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
  const toggle = (which: "all" | "funktionen" | "usecases" | "analytics" | "info", el: HTMLElement | null) => {
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
        {(["funktionen", "usecases", "analytics", "info"] as const).map((g) => (
          <button key={g} type="button" data-menu-trigger aria-expanded={open === g} aria-controls="hauptmenue" onClick={(e) => toggle(g, e.currentTarget)}>
            {g === "funktionen" ? "Funktionen" : g === "usecases" ? "Use Cases" : g === "analytics" ? "Plenara.X" : "Entdecken"}
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
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "usecases"} onClick={() => setOpenGroup(openGroup === "usecases" ? "" : "usecases")}>
                  Use Cases
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "usecases" ? "rotate-180" : ""}`} />
                </button>}
                {show("usecases") && (
                  <ul className="ri-menu__subs">
                    {BRANCHEN.map((b) => {
                      const href = `/branchen/${b.slug}`;
                      return (
                        <li key={b.slug}>
                          <Link href={href} className="ri-menu__sub" aria-current={current(href)} onClick={pick}>
                            <Icon name={b.icon} size={15} />
                            {b.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "analytics"} onClick={() => setOpenGroup(openGroup === "analytics" ? "" : "analytics")}>
                  Plenara.X
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "analytics" ? "rotate-180" : ""}`} />
                </button>}
                {show("analytics") && (
                  <ul className="ri-menu__subs">
                    {ANALYTICS.map((f) => (
                      <li key={f.href}>
                        <Link href={f.href} className="ri-menu__sub" aria-current={current(f.href)} onClick={pick}>
                          <Icon name={f.icon} size={15} />
                          {f.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {open === "all" && <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "info"} onClick={() => setOpenGroup(openGroup === "info" ? "" : "info")}>
                  Entdecken
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
              {open === "all" && tier === "guest" && (
                <div className="ri-menu__start">
                  <Link href="/registrieren?tarif=free" className="btn-primary w-full" onClick={pick}>
                    Kostenlos starten
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
