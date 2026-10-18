import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePhone } from "../lib/usePhone";
import { MainMenu } from "../menu/MainMenu";
import { AccountMenu } from "./AccountMenu";
import { Brand } from "./Brand";
import { DevTierSwitcher } from "./DevTierSwitcher";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const kontoPage = pathname.startsWith("/konto/") ? pathname.split("/")[2] : "";

  const phone = usePhone();
  /* Handy: beim Scrollen nach unten blendet sich die Kopfzeile aus, beim Hochscrollen kommt sie wieder (nicht auf Start und Suche mit Karte).
     Direkt am Element und an der Variable --rm-head, damit mitlaufende Leisten (Gespeichert-Umschalter) mitrutschen; kein State */
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = bar.current, root = document.documentElement;
    if (!el || !phone || pathname === "/" || pathname === "/suche" || pathname.startsWith("/analytics") || pathname.startsWith("/konto") || pathname.startsWith("/anwender")) return;
    let last = window.scrollY, raf = 0;
    const set = (hidden: boolean) => { el.style.transform = hidden ? "translateY(-100%)" : ""; root.style.setProperty("--rm-head", hidden ? "0px" : `${el.offsetHeight}px`); };
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY, d = y - last;
        if (Math.abs(d) < 8) return;
        set(d > 0 && y > 120);
        last = y;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); set(false); };
  }, [phone, pathname]);

  /* Handy, Seiten mit Band: Der große Titel wandert beim Scrollen klein in die Kopfzeile (wie bei iOS), Tipp darauf: nach oben.
     Die Kopfzeile blendet sich dort nicht mehr aus, damit der Titel stehen bleibt. */
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!phone) return;
    let raf = 0;
    const h1 = () => document.querySelector<HTMLElement>(".pl-band h1, .ri-head h1, .ri-head .ri-h1");
    const read = () => {
      raf = 0;
      const el = h1();
      if (!el) { setTitle(""); return; }
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() || (el.textContent ?? "").trim();
      setTitle(el.getBoundingClientRect().bottom < (bar.current?.offsetHeight ?? 44) ? own : "");
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    const t = setTimeout(on, 400);
    return () => { window.removeEventListener("scroll", on); clearTimeout(t); cancelAnimationFrame(raf); setTitle(""); };
  }, [phone, pathname]);

  /* Handy: Wischen vom linken Rand geht eine Seite zurück (wie bei iOS), außer auf Start, Suche und in Blättern/Feldern */
  useEffect(() => {
    if (!phone || pathname === "/" || pathname === "/suche") return;
    let s: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      s = e.touches.length === 1 && t.clientX < 20 && !document.querySelector('[role="dialog"], [data-sheet]') ? { x: t.clientX, y: t.clientY } : null;
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (s && t.clientX - s.x > 80 && Math.abs(t.clientY - s.y) < 50 && window.history.length > 1) router.back();
      s = null;
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    return () => { window.removeEventListener("touchstart", down); window.removeEventListener("touchend", up); };
  }, [phone, pathname, router]);

  /* Logo: zur Startseite; auf dem Handy dazu an den Seitenanfang. Suche und Filter bleiben dabei unverändert. */
  const leave = () => {
    if (pathname !== "/") router.push("/");
    if (phone) window.scrollTo({ top: 0, behavior: pathname === "/" ? "smooth" : "auto" });
  };

  return (
    <header ref={bar} data-title={title ? "1" : undefined} className="sticky top-0 z-[1100] border-b-2 border-teal-600 bg-white transition-transform duration-200 motion-reduce:transition-none">
      <div className="flex h-[56px] max-sm:h-[42px] max-sm:pb-1 items-center justify-between gap-2 px-4 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-[14px]">
          <MainMenu />
          <Brand onClick={leave} />
          {title && <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="rm-headtitle absolute left-4 right-16 top-0 z-10 flex h-[42px] items-center truncate text-left text-[18px] font-semibold sm:hidden" aria-label={`${title}, nach oben`}><span className="truncate">{title}</span></button>}
        </div>
        <div className="flex flex-none items-center gap-3">
          <DevTierSwitcher />
          <AccountMenu currentPage={kontoPage} />
        </div>
      </div>
    </header>
  );
}
