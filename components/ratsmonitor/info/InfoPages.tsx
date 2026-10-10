import { useSearchParams } from "next/navigation";
import { QuellenPage } from "./QuellenPage";
import { BenachrichtigungenPage } from "./BenachrichtigungenPage";
import { useEffect, type ComponentType } from "react";
import { AboutPage } from "./AboutPage";
import { KontaktPage, LoginPage, RegisterPage } from "./AccountPages";
import { BranchePage } from "./BranchenPages";
import { brancheBySlug } from "./content";
import { FaqPage } from "./FaqPage";
import { VideosPage } from "./VideosPage";
import { PreisePage } from "./PreisePage";
import { AgbPage } from "./AgbPage";
import { WiderrufPage } from "./WiderrufPage";
import { LenaPage } from "./LenaPage";

const PAGES: Record<string, ComponentType> = {
  "/lena": LenaPage,
  "/faq": FaqPage,
  "/videos": VideosPage,
  "/datenabdeckung": QuellenPage,
  "/funktionen/suche": AboutPage,
  "/funktionen/benachrichtigungen": BenachrichtigungenPage,
  "/preise": PreisePage,
  "/anmelden": LoginPage,
  "/kontakt": KontaktPage,
  "/agb": AgbPage,
  "/widerruf": WiderrufPage,
};

export const isInfoPath = (p: string) => p in PAGES || p === "/registrieren" || !!brancheOf(p);
const brancheOf = (p: string) => (p.startsWith("/anwender/") ? brancheBySlug(p.slice(10)) : undefined);

/** Seiten des Dreistrichmenüs; eingehängt neben Übersicht, Detail- und Kontoseiten */
export function InfoPages({ path }: { path: string }) {
  const query = useSearchParams().toString();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  const b = brancheOf(path);
  const Page = PAGES[path];
  return (
    <main id="inhalt" className="ri">
      {b ? <BranchePage key={b.slug} b={b} /> : path === "/registrieren" ? <RegisterPage key={query} /> : Page ? <Page key={path} /> : null}
    </main>
  );
}
