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
      title="Diese Seite gibt es nicht (mehr)."
      lead="Der Link ist vielleicht veraltet oder enthält einen Tippfehler."
    >
      <div className="ri-actions">
        <Link href="/suche" className="ri-btn ri-btn--dark">
          Zur Suche
        </Link>
        <Link href="/" className="ri-btn ri-btn--light">
          Zur Startseite
        </Link>
        <Link href="/kontakt" className="ri-btn ri-btn--light">
          Kontakt aufnehmen
        </Link>
      </div>
    </PageHead>
    </main>
  );
}
