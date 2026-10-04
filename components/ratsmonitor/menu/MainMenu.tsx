import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { BRANCHEN } from "../info/content";
import { useBrandText } from "../lib/brand";
import { Icon } from "../info/icons";

const MAIN_TOP = [
  { href: "/ueber-ratsmonitor", label: "Über Ratsmonitor" },
  { href: "/faq", label: "FAQ" },
  { href: "/branchen", label: "Branchen & Anwendungsfälle" },
];

/** Dreistrichmenü: Knopf in der Kopfzeile, Auswahl klappt links unterhalb der Kopfzeile auf und braucht nur so viel Platz wie nötig */
export function MainMenu() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 60, left: 8 });
  const path = usePathname();
  const brandText = useBrandText();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
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
            <div ref={panelRef} id="hauptmenue" className="ri-menu__panel" role="dialog" aria-label="Hauptmenü" style={{ top: pos.top, left: pos.left, maxHeight: `calc(100dvh - ${pos.top}px - 12px)` }} onKeyDown={trap}>
              <nav className="ri-menu__nav" aria-label="Menü">
                <p className="ri-menu__label">Menü</p>
                {MAIN_TOP.map((m) => (
                  <Link key={m.href} href={m.href} className="ri-menu__main" aria-current={current(m.href)} onClick={pick}>
                    {brandText(m.label)}
                  </Link>
                ))}
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
                <Link href="/preise" className="ri-menu__main" aria-current={current("/preise")} onClick={pick}>
                  Preise & Tarife
                </Link>
              </nav>
              <div className="ri-menu__start">
                <strong>Kostenlos starten</strong>
                <p>Suchen speichern und Beschlüsse merken.</p>
                <Link href="/registrieren?tarif=free" onClick={pick}>
                  Konto erstellen →
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
