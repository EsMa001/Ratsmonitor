import Link from "next/link";
import { PageHead } from "./blocks";

/** Eigene 404-Seite im Stil der Info-Seiten (statt der englischen Standardseite) */
export function NotFoundPage() {
  return (
    <main id="inhalt" className="ri">
    <PageHead
      icon="search"
      label="Fehler 404"
      name="Seite nicht gefunden"
      title={
        <>
          Diese Seite gibt es
          <br />
          nicht (mehr).
        </>
      }
      lead="Der Link ist vielleicht veraltet oder enthält einen Tippfehler. Von der Startseite aus finden Sie alles wieder."
    >
      <div className="ri-actions">
        <Link href="/" className="ri-btn ri-btn--dark">
          Zur Startseite
        </Link>
        <Link href="/preise" className="ri-btn ri-btn--light">
          Preise ansehen
        </Link>
        <Link href="/kontakt" className="ri-btn ri-btn--light">
          Kontakt aufnehmen
        </Link>
      </div>
    </PageHead>
    </main>
  );
}
