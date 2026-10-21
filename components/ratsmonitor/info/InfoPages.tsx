import { useSearchParams } from "next/navigation";
import { QuellenPage } from "./QuellenPage";
import { BenachrichtigungenPage } from "./BenachrichtigungenPage";
import { useEffect, type ComponentType } from "react";
import { ConfirmLoginPage, KontaktPage, LoginPage, RegisterPage } from "./AccountPages";
import { ConnectPage } from "./ConnectPage";
import { BranchePage } from "./BranchenPages";
import { brancheOf } from "../lib/routes";
import { FaqPage } from "./FaqPage";
import { VideosPage } from "./VideosPage";
import { PreisePage } from "./PreisePage";
import { AgbPage } from "./AgbPage";
import { WiderrufPage } from "./WiderrufPage";
import { StartseitePage } from "./StartseitePage";

const PAGES: Record<string, ComponentType> = {
  "/": StartseitePage,
  "/faq": FaqPage,
  "/videos": VideosPage,
  "/datenabdeckung": QuellenPage,
  "/funktionen/benachrichtigungen": BenachrichtigungenPage,
  "/preise": PreisePage,
  "/anmelden": LoginPage,
  "/anmelden/bestaetigen": ConfirmLoginPage,
  "/verbinden": ConnectPage,
  "/kontakt": KontaktPage,
  "/agb": AgbPage,
  "/widerruf": WiderrufPage,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isInfoPath } from "../lib/routes";

/** Seiten des Dreistrichmenüs; eingehängt neben Übersicht, Detail- und Kontoseiten */
export function InfoPages({ path }: { path: string }) {
  const query = useSearchParams().toString();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  const b = brancheOf(path);
  const Page = PAGES[path];
  return (
    <main id="inhalt" className={path.startsWith("/anwender/") ? "ri ri-anw" : "ri"}>
      {b ? <BranchePage key={b.slug} b={b} /> : path === "/registrieren" ? <RegisterPage key={query} /> : Page ? <Page key={path} /> : null}
    </main>
  );
}
