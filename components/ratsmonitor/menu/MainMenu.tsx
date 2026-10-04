import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { BRANCHEN } from "../info/content";
import { useBrandText } from "../lib/brand";
import { Icon } from "../info/icons";
import { useTier } from "../lib/tier";
import { IconChevronDown } from "../components/icons";

/* Unterpunkte von „Funktionen“: Erklärseiten (Suche, Benachrichtigungen) und die Arbeitsbereiche */
const FUNKTIONEN: { href: string; label: string; icon: "search" | "clipboardList" | "bell" | "calendar" | "fileText" }[] = [
  { href: "/funktionen/suche", label: "Suche", icon: "search" },
  { href: "/konto/suchen", label: "Gespeicherte Suchen", icon: "clipboardList" },
  { href: "/konto/artikel", label: "Gespeicherte Artikel", icon: "fileText" },
  { href: "/funktionen/benachrichtigungen", label: "Benachrichtigungen", icon: "bell" },
  { href: "/konto/kalender", label: "Kalender", icon: "calendar" },
];

const MAIN_TOP = [
  { href: "/ueber-ratsmonitor", label: "Über uns" },
  { href: "/faq", label: "FAQ" },
];

/** Dreistrichmenü: Knopf in der Kopfzeile, Auswahl klappt links unterhalb der Kopfzeile auf und braucht nur so viel Platz wie nötig */
export function MainMenu() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 60, left: 8 });
  const path = usePathname();
  const brandText = useBrandText();
  const { tier } = useTier();
  /* Eingeklappt starten; die Gruppe der aktuellen Seite ist offen */
  const [openGroup, setOpenGroup] = useState(() => (path.startsWith("/branchen/") ? "usecases" : path.startsWith("/funktionen/") || path.startsWith("/konto/") ? "funktionen" : ""));
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
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
  const toggle = () => {
    if (open) return close();
    const btn = btnRef.current?.getBoundingClientRect();
    const head = btnRef.current?.closest("header")?.getBoundingClientRect();
    setPos({ top: Math.max(0, Math.round(head?.bottom ?? 60)), left: Math.max(8, Math.round(btn?.left ?? 8)) });
    setOpen(true);
  };
  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <>
      <button ref={btnRef} type="button" className="ri-burger" aria-label={open ? "Menü schließen" : "Menü öffnen"} aria-expanded={open} aria-controls="hauptmenue" onClick={toggle}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6.5h16M4 12h12M4 17.5h8" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="ri-menu">
            <div className="ri-menu__bg" onClick={close} aria-hidden="true" />
            <div ref={panelRef} id="hauptmenue" tabIndex={-1} className="ri-menu__panel outline-none" role="dialog" aria-label="Hauptmenü" style={{ top: pos.top, left: pos.left, maxHeight: `calc(100dvh - ${pos.top}px - 12px)` }} onKeyDown={trap}>
              {/* Gleiche Gruppen wie in der Fußzeile; Linien statt Kästen. Gespeichertes und Konto erreicht man über die Icons in der Kopfzeile */}
              <nav className="ri-menu__nav" aria-label="Menü">
                <p className="ri-menu__label">Produkt</p>
                {/* Funktionen und Use Cases sind einklappbar; die Gruppen selbst sind keine Seiten */}
                <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "funktionen"} onClick={() => setOpenGroup(openGroup === "funktionen" ? "" : "funktionen")}>
                  Funktionen
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "funktionen" ? "rotate-180" : ""}`} />
                </button>
                {openGroup === "funktionen" && (
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
                <button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup === "usecases"} onClick={() => setOpenGroup(openGroup === "usecases" ? "" : "usecases")}>
                  Use Cases
                  <IconChevronDown size={16} className={`ri-menu__chev ${openGroup === "usecases" ? "rotate-180" : ""}`} />
                </button>
                {openGroup === "usecases" && (
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
                <Link href="/preise" className="ri-menu__main" aria-current={current("/preise")} onClick={pick}>Preismodelle</Link>
                <p className="ri-menu__label ri-menu__label--sep">Informationen</p>
                <Link href="/faq" className="ri-menu__main" aria-current={current("/faq")} onClick={pick}>FAQ</Link>
                <Link href="/quellen" className="ri-menu__main" aria-current={current("/quellen")} onClick={pick}>Datenabdeckung</Link>
                <Link href="/ueber-uns" className="ri-menu__main" aria-current={current("/ueber-uns")} onClick={pick}>{brandText("Über Ratsmonitor")}</Link>
              </nav>
              {tier === "guest" && (
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
