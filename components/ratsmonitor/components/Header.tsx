import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconChevronLeft } from "./icons";
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
  const title = useScrolledTitle(phone, pathname);
  /* Hauptziele der unteren Leiste haben kein Zurück */
  const root = pathname === "/" || pathname === "/suche" || pathname === "/konto/suchen" || pathname === "/konto/profil";

  /* Logo: zur Startseite; auf dem Handy dazu an den Seitenanfang. Suche und Filter bleiben dabei unverändert. */
  const leave = () => {
    if (pathname !== "/") router.push("/");
    if (phone) window.scrollTo({ top: 0, behavior: pathname === "/" ? "smooth" : "auto" });
  };

  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white">
      <div className="flex h-[56px] items-center justify-between gap-2 px-4 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-[14px]">
          {title && !root ? (
            <button type="button" aria-label="Zurück" onClick={() => router.back()} className="-ml-2 grid h-10 w-10 flex-none place-items-center text-slate-700"><IconChevronLeft /></button>
          ) : <MainMenu />}
          {title ? <p className="m-0 min-w-0 truncate text-[16px] font-semibold text-slate-900 rm-fade-in">{title}</p> : <Brand onClick={leave} />}
        </div>
        <div className="flex flex-none items-center gap-3">
          <DevTierSwitcher />
          <AccountMenu currentPage={kontoPage} />
        </div>
      </div>
    </header>
  );
}

/** Handy: Titel der Seite (erste Überschrift h1; nicht auf der Startseite, dort bleibt das Logo), sobald sie unter der Kopfzeile verschwunden ist, wie bei iOS-Apps. */
function useScrolledTitle(phone: boolean, path: string) {
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!phone || path === "/") return;
    let raf = 0;
    const check = () => {
      raf = 0;
      /* Nur sichtbare Überschriften (nicht die für Screenreader versteckte der Suche) */
      const h = [...document.querySelectorAll("h1")].find((x) => !x.closest("header") && x.offsetHeight > 4);
      const gone = !!h && h.getBoundingClientRect().bottom < 56;
      setTitle(gone ? (h.textContent ?? "").replace(/plenara\s*X?$/, "").trim() : "");
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [phone, path]);
  return phone && path !== "/" ? title : "";
}
