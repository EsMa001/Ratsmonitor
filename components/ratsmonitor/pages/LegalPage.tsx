import type { ReactNode } from "react";
import { useBrand } from "../lib/brand";
import { PageHead } from "../info/blocks";

/* Platzhalter: vor Veröffentlichung durch die echten Angaben des Betreibers ersetzen */
const BETREIBER = {
  name: "[Vor- und Nachname bzw. Name der Organisation]",
  strasse: "[Straße Hausnummer]",
  ort: "[PLZ Ort]",
  email: "[kontakt@beispiel.de]",
  telefon: "[Telefonnummer]",
};

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-7 text-[18px] font-semibold text-slate-900">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 leading-relaxed text-slate-500">{children}</p>;
}
function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3 list-disc space-y-1 pl-5 leading-relaxed text-slate-500">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function Anschrift() {
  return (
    <P>
      {BETREIBER.name}
      <br />
      {BETREIBER.strasse}
      <br />
      {BETREIBER.ort}
      <br />
      E-Mail: {BETREIBER.email}
      <br />
      Telefon: {BETREIBER.telefon}
    </P>
  );
}

function Impressum() {
  const { name } = useBrand();
  return (
    <>
      <H2>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</H2>
      <Anschrift />
      <H2>Verantwortlich für den Inhalt nach § 18 Abs. 2 Medienstaatsvertrag (MStV)</H2>
      <P>
        {BETREIBER.name}, {BETREIBER.strasse}, {BETREIBER.ort}
      </P>
      <H2>Hinweis zu den Inhalten</H2>
      <P>
        {name} bereitet öffentlich zugängliche Informationen aus Ratsinformationssystemen von Kommunen und Kreisen auf. Zusammenfassungen werden teilweise
        automatisiert, auch mit Hilfe künstlicher Intelligenz, erstellt und können Fehler enthalten. Maßgeblich sind ausschließlich die verlinkten Originalunterlagen der
        jeweiligen Kommune.
      </P>
      <H2>Haftung für Links</H2>
      <P>
        Diese Website enthält Links zu externen Websites Dritter, insbesondere zu Ratsinformationssystemen. Auf deren Inhalte haben wir keinen Einfluss; für sie ist
        stets der jeweilige Anbieter verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir entsprechende Links umgehend.
      </P>
      <H2>Kartendaten</H2>
      <P>
        Verwaltungsgrenzen: © GeoBasis-DE / BKG 2019 (VG250), Datenlizenz Deutschland – Namensnennung – Version 2.0, vereinfacht dargestellt. Nachbarstaaten: Natural
        Earth (gemeinfrei).
      </P>
      <H2>Verbraucherstreitbeilegung</H2>
      <P>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</P>
    </>
  );
}

function Datenschutz() {
  const { name } = useBrand();
  return (
    <>
      <P>Stand: Oktober 2026</P>

      <H2>1. Verantwortlicher</H2>
      <P>Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</P>
      <Anschrift />

      <H2>2. Das Wichtigste in Kürze</H2>
      <Ul
        items={[
          "Für die Nutzung ist kein Benutzerkonto nötig.",
          "Wir setzen keine Analyse- oder Tracking-Werkzeuge und keine Werbe-Cookies ein.",
          "Gespeicherte Suchen bleiben ausschließlich in Ihrem Browser.",
          "Schriftarten und Kartendaten werden von unserem eigenen Server ausgeliefert; beim Aufruf der Seite werden keine Daten an Google Fonts oder Kartendienste übertragen.",
          "Personenbezogene Daten werden an Dritte nur übermittelt, soweit es für den Betrieb technisch erforderlich ist oder Sie es selbst auslösen (z. B. Push-Mitteilungen).",
        ]}
      />

      <H2>3. Hosting, Server-Logfiles und Datenbank (Cloudflare)</H2>
      <P>
        Die Website wird bei Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA, betrieben (Cloudflare Workers, Datenbank Cloudflare D1). Beim Aufruf
        der Website verarbeitet Cloudflare technisch notwendig folgende Daten: IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Adresse inklusive Suchparametern,
        übertragene Datenmenge, Browsertyp und Betriebssystem (User-Agent) sowie die zuvor besuchte Seite (Referrer). Cloudflare setzt zum Schutz vor Angriffen ggf.
        technisch notwendige Sicherheitsmechanismen ein.
      </P>
      <P>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt im sicheren und stabilen Betrieb der Website. Mit Cloudflare besteht ein
        Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Eine Übermittlung in die USA ist möglich; Cloudflare ist unter dem EU-U.S. Data Privacy Framework
        zertifiziert (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO), ergänzend gelten Standardvertragsklauseln. Logdaten werden von Cloudflare nur kurzzeitig
        gespeichert und anschließend gelöscht.
      </P>

      <H2>4. Suche und Filter</H2>
      <P>
        Ihre Suchbegriffe, gewählten Gebiete, Zeiträume und Filter werden an unseren Server übermittelt, um passende Einträge aus unserer Datenbank zu ermitteln. Wir
        speichern diese Anfragen nicht dauerhaft und verknüpfen sie nicht mit Ihrer Person. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Bereitstellung der von Ihnen
        angeforderten Funktion).
      </P>

      <H2>5. Gespeicherte Suchen (lokaler Speicher Ihres Browsers)</H2>
      <P>
        Wenn Sie eine Suche speichern (Herz-Symbol), wird sie im lokalen Speicher (localStorage) Ihres Browsers abgelegt. Diese Daten verlassen Ihr Gerät nicht und
        werden nicht an uns übertragen. Die Speicherung ist für die von Ihnen ausdrücklich gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2
        Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz, TDDDG). Sie können gespeicherte Suchen jederzeit unter „Konto → Gespeicherte Suchen“ entfernen oder den
        Website-Speicher in Ihren Browser-Einstellungen löschen.
      </P>

      <H2>6. Push-Mitteilungen</H2>
      <P>
        Sie können Push-Mitteilungen freiwillig aktivieren. Dazu registriert die Website einen Service Worker in Ihrem Browser und fragt Ihre Erlaubnis ab. Bei Zustimmung
        erzeugt Ihr Browser eine Push-Adresse (Endpoint) mit zugehörigen Schlüsseln, die wir auf unserem Server speichern, um Ihnen Mitteilungen senden zu können.
      </P>
      <P>
        Die Zustellung erfolgt technisch über den Push-Dienst Ihres Browserherstellers, z. B. Google Firebase Cloud Messaging (Google Ireland Ltd., für Chrome/Edge auf
        Android), Mozilla Push Service (Mozilla Corporation, für Firefox), Apple Push Notification Service (Apple Inc., für Safari) oder Windows Push Notification
        Services (Microsoft Corp.). Diese Anbieter erhalten dabei die Push-Adresse und den verschlüsselten Inhalt der Mitteilung; Übermittlungen in Drittländer (USA) sind
        möglich und auf Grundlage des EU-U.S. Data Privacy Framework abgesichert.
      </P>
      <P>
        Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Sie können sie jederzeit widerrufen, indem Sie die Berechtigung für Mitteilungen
        in Ihren Browser-Einstellungen entziehen. Die gespeicherte Push-Adresse wird dann gelöscht; ungültig gewordene Adressen
        entfernen wir automatisch.
      </P>

      <H2>7. Datenquellen und genutzte Schnittstellen (APIs)</H2>
      <P>Für die Inhalte von {name} greift ausschließlich unser Server auf folgende Schnittstellen zu. Ihr Browser stellt dabei keine Verbindung zu diesen Diensten her.</P>
      <Ul
        items={[
          <>
            <strong>Ratsinformationssysteme der Kommunen und Kreise</strong> (u. a. OParl-Schnittstellen sowie öffentliche Webseiten von Systemen wie SessionNet, ALLRIS
            und SD.NET): Wir rufen öffentlich bereitgestellte Vorlagen, Sitzungen, Beschlüsse und Dokumente ab. Diese können Namen von Mandatsträgerinnen und
            Mandatsträgern, Gremienmitgliedern oder Verwaltungsbeschäftigten enthalten. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO; unser
            berechtigtes Interesse ist die verständliche Aufbereitung amtlich veröffentlichter Informationen über Kommunalpolitik. Wir übernehmen nur, was die Kommune
            selbst veröffentlicht hat, und verweisen stets auf die Originalquelle.
          </>,
          <>
            <strong>OpenAI API</strong> (OpenAI Ireland Ltd., Dublin, bzw. OpenAI, L.L.C., San Francisco, USA): Zur Erstellung von Zusammenfassungen und zur thematischen
            Einordnung übermitteln wir Texte aus den öffentlichen Ratsunterlagen an die Schnittstelle von OpenAI. Daten von Besucherinnen und Besuchern der Website, etwa
            Suchanfragen oder IP-Adressen, werden dabei nicht übermittelt. Nach Angaben von OpenAI werden über die API übermittelte Daten nicht zum Training von Modellen
            verwendet und höchstens 30 Tage zur Missbrauchserkennung gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; eine Übermittlung in die USA ist durch
            das EU-U.S. Data Privacy Framework bzw. Standardvertragsklauseln abgesichert.
          </>,
          <>
            <strong>Kartendaten</strong> des Bundesamts für Kartographie und Geodäsie (VG250) und von Natural Earth sind in die Website eingebunden und werden von unserem
            Server ausgeliefert. Es wird kein externer Kartendienst geladen.
          </>,
        ]}
      />

      <H2>8. Links zu Originalquellen und Teilen</H2>
      <P>
        Artikel verlinken auf Sitzungen und Dokumente in den Ratsinformationssystemen der jeweiligen Kommune. Erst wenn Sie einen solchen Link anklicken, baut Ihr Browser
        eine Verbindung zum Server dieser Kommune bzw. ihres IT-Dienstleisters auf; dort gelten deren Datenschutzbestimmungen.
      </P>
      <P>
        Über die Schaltfläche „Link teilen“ wird die Adresse des Artikels an das Teilen-Menü Ihres Geräts übergeben oder in die Zwischenablage kopiert. Wir erhalten dabei keine Daten; an wen Sie den Link weitergeben, entscheiden Sie selbst in der jeweiligen App.
      </P>

      <H2>9. Anmeldung zur Administration</H2>
      <P>
        Der geschützte Administrationsbereich ist nur für Betreiber bestimmt. Die Anmeldung erfolgt über „Mit ChatGPT anmelden“ von OpenAI. Dabei erhalten wir eine
        Nutzerkennung, den Namen und die E-Mail-Adresse der angemeldeten Person, um die Berechtigung zu prüfen und Änderungen zuzuordnen. Rechtsgrundlage ist Art. 6 Abs. 1
        lit. b bzw. f DSGVO. Für normale Besucherinnen und Besucher findet keine Anmeldung statt.
      </P>

      <H2>10. Speicherdauer</H2>
      <P>
        Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist: Push-Adressen bis zum Widerruf, Anmeldedaten der
        Administration für die Dauer der Berechtigung, Inhalte aus Ratsinformationssystemen so lange, wie sie für die Darstellung kommunalpolitischer Vorgänge relevant sind
        oder bis die Kommune sie zurückzieht.
      </P>

      <H2>11. Ihre Rechte</H2>
      <P>Sie haben im Rahmen der gesetzlichen Vorgaben jederzeit das Recht auf</P>
      <Ul
        items={[
          "Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO),",
          "Berichtigung unrichtiger Daten (Art. 16 DSGVO),",
          "Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO),",
          "Datenübertragbarkeit (Art. 20 DSGVO),",
          "Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO aus Gründen, die sich aus Ihrer besonderen Situation ergeben (Art. 21 DSGVO),",
          "Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).",
        ]}
      />
      <P>
        Wenden Sie sich dazu an die oben genannte Kontaktadresse. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), etwa bei der
        Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestraße 2–4, 40213 Düsseldorf.
      </P>

      <H2>12. Keine automatisierte Entscheidungsfindung</H2>
      <P>Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt.</P>

      <H2>13. Änderungen</H2>
      <P>Wir passen diese Datenschutzerklärung an, wenn sich die Website oder die Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung.</P>
    </>
  );
}

export function LegalPage({ kind }: { kind: "impressum" | "datenschutz" }) {
  /* Gleicher Aufbau wie die Info-Seiten: Kopf mit Zurück-Link, Text ohne Rahmen */
  const imp = kind === "impressum";
  return (
    <main id="inhalt" className="ri">
      <PageHead icon={imp ? "fileText" : "shieldCheck"} label="Rechtliches" name={imp ? "Impressum" : "Datenschutz"} title={imp ? "Impressum" : "Datenschutzerklärung"} />
      <section className="ri-sec ri-sec--tight">
        <div className="max-w-[80ch] [&>h2:first-child]:mt-0">{imp ? <Impressum /> : <Datenschutz />}</div>
      </section>
    </main>
  );
}
