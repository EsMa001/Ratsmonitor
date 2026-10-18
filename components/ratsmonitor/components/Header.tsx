import { useEffect, useRef } from "react";
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
    if (!el || !phone || pathname === "/" || pathname === "/suche") return;
    let last = window.scrollY, raf = 0;
    const set = (hidden: boolean) => { el.style.transform = hidden ? "translateY(-100%)" : ""; root.style.setProperty("--rm-head", hidden ? "0px" : "58px"); };
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

  /* Logo: zur Startseite; auf dem Handy dazu an den Seitenanfang. Suche und Filter bleiben dabei unverändert. */
  const leave = () => {
    if (pathname !== "/") router.push("/");
    if (phone) window.scrollTo({ top: 0, behavior: pathname === "/" ? "smooth" : "auto" });
  };

  return (
    <header ref={bar} className="sticky top-0 z-[1100] border-b-2 border-teal-600 bg-white transition-transform duration-200 motion-reduce:transition-none">
      <div className="flex h-[56px] items-center justify-between gap-2 px-4 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-[14px]">
          <MainMenu />
          <Brand onClick={leave} />
        </div>
        <div className="flex flex-none items-center gap-3">
          <DevTierSwitcher />
          <AccountMenu currentPage={kontoPage} />
        </div>
      </div>
    </header>
  );
}
