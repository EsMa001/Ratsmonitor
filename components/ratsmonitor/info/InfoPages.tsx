import { useSearchParams } from "next/navigation";
import { QuellenPage } from "./QuellenPage";
import { UeberUnsPage } from "./UeberUnsPage";
import { useEffect, type ComponentType } from "react";
import { AboutPage } from "./AboutPage";
import { KontaktPage, LoginPage, RegisterPage } from "./AccountPages";
import { PageHead } from "./blocks";
import { BranchePage, BranchenPage } from "./BranchenPages";
import { AGB_SECTIONS, brancheBySlug } from "./content";
import { FaqPage } from "./FaqPage";
import { PreisePage } from "./PreisePage";

/* TODO: Rechtstext vom Betreiber (Doku Kap. 8) */
function AgbPage() {
  return (
    <>
      <PageHead icon="fileText" label="Rechtliches" name="Rechtliches" title="Allgemeine Geschäftsbedingungen" lead="Platzhalter: Der verbindliche Rechtstext wird vom Betreiber ergänzt." />
      <section className="ri-sec">
        <div className="ri-legal">
          {AGB_SECTIONS.map((t, i) => (
            <div key={t}>
              <h2>
                {i + 1}. {t}
              </h2>
              <p>Text folgt.</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const PAGES: Record<string, ComponentType> = {
  "/ueber-ratsmonitor": AboutPage,
  "/faq": FaqPage,
  "/quellen": QuellenPage,
  "/ueber-uns": UeberUnsPage,
  "/branchen": BranchenPage,
  "/preise": PreisePage,
  "/anmelden": LoginPage,
  "/kontakt": KontaktPage,
  "/agb": AgbPage,
};

export const isInfoPath = (p: string) => p in PAGES || p === "/registrieren" || !!brancheOf(p);
const brancheOf = (p: string) => (p.startsWith("/branchen/") ? brancheBySlug(p.slice(10)) : undefined);

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
