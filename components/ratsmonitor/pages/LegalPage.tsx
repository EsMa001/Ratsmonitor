import Link from "next/link";
import { useEffect, useRef } from "react";
import { useBrand } from "../lib/brand";
import { BETREIBER } from "../lib/betreiber";
import { PageHead } from "../info/blocks";
import { H2, P, Ul } from "../info/LegalText";

function Anschrift() {
  return (
    <P>
      {BETREIBER.name}
      <br />
      vertreten durch die Gesellschafter {BETREIBER.gesellschafter.join(" und ")}
      <br />
      {BETREIBER.strasse}
      <br />
      {BETREIBER.ort}
    </P>
  );
}

function Impressum() {
  const { name } = useBrand();
  return (
    <>
      <H2>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</H2>
      <Anschrift />
      <H2>Kontakt</H2>
      <P>
        E-Mail: <a href={`mailto:${BETREIBER.email}`} className="ri-link">{BETREIBER.email}</a>
        <br />
        Weitere Wege finden Sie auf der <Link href="/kontakt" className="ri-link">Kontaktseite</Link>.
      </P>
      <H2>Verantwortlich für den Inhalt nach § 18 Abs. 2 Medienstaatsvertrag (MStV)</H2>
      <P>
        {BETREIBER.gesellschafter.join(" und ")}, Anschrift wie oben
      </P>
      <H2>Hinweis zu den Inhalten</H2>
      <P>
        {name} bereitet öffentlich zugängliche Informationen aus Ratsinformationssystemen von Kommunen und Kreisen auf. Zusammenfassungen, Themen und Kennzahlen
        entstehen automatisiert, überwiegend nach festen Regeln und teilweise mit Hilfe künstlicher Intelligenz. Sie können Fehler enthalten. Maßgeblich sind
        ausschließlich die verlinkten Originalunterlagen der jeweiligen Kommune.
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
      <P>Stand: 19. Oktober 2026</P>

      <H2>1. Verantwortlicher</H2>
      <P>Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</P>
      <Anschrift />
      <P>
        E-Mail: <a href={`mailto:${BETREIBER.email}`} className="ri-link">{BETREIBER.email}</a>. Einen Datenschutzbeauftragten haben wir nicht benannt, weil wir dazu
        nicht verpflichtet sind; Fragen zum Datenschutz richten Sie bitte an diese Adresse.
      </P>

      <H2>2. Das Wichtigste in Kürze</H2>
      <Ul
        items={[
          "Die Suche ist ohne Konto nutzbar. Ein Konto brauchen Sie für gespeicherte Suchen und Artikel, den Kalender, Plus und Pro.",
          "Die Anmeldung geschieht ohne Passwort, mit einem Link oder Code per E-Mail.",
          "Wir setzen keine Analyse- oder Tracking-Werkzeuge und keine Werbe-Cookies ein. Es gibt nur technisch notwendige Cookies.",
          "Unser Server steht in einem Rechenzentrum in Deutschland. Schriftarten und Kartendaten liefern wir selbst aus; beim Aufruf der Seite werden keine Daten an Google Fonts oder Kartendienste übertragen.",
          "Ihre Daten geben wir nur an Dienstleister weiter, die wir für den Betrieb brauchen (Hosting, E-Mail), und nur in unserem Auftrag.",
        ]}
      />

      <H2>3. Hosting und Server-Protokolle</H2>
      <P>
        Die Website läuft auf einem eigenen Server, den wir bei Hostinger International Ltd., 61 Lordou Vironos Street, 6023 Larnaca, Zypern, mieten. Der Server steht in
        einem Rechenzentrum in Deutschland. Beim Aufruf der Website verarbeitet unser Server technisch notwendig Ihre IP-Adresse, Datum und Uhrzeit, die aufgerufene
        Adresse und die Kennung Ihres Browsers, um die Seite auszuliefern.
      </P>
      <P>
        Der Webserver schreibt keine Zugriffsprotokolle. Technische Protokolle der Anwendung (etwa Fehlermeldungen und Laufzeiten) enthalten keine Suchbegriffe und keine
        IP-Adressen und werden nach 7 Tagen gelöscht. Um Missbrauch der Anmeldung zu begrenzen, speichern wir statt Ihrer IP-Adresse einen nicht umkehrbaren Prüfwert
        für einen Tag.
      </P>
      <P>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt im sicheren und stabilen Betrieb der Website. Hostinger verarbeitet die Daten
        als Auftragsverarbeiter auf Grundlage eines Vertrags nach Art. 28 DSGVO.
      </P>

      <H2>4. Suche und Filter</H2>
      <P>
        Ihre Suchbegriffe, gewählten Gebiete, Zeiträume und Filter werden an unseren Server übermittelt, um passende Einträge aus unserer Datenbank zu ermitteln. Wir
        speichern diese Anfragen nicht dauerhaft und verknüpfen sie nicht mit Ihrer Person. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Bereitstellung der von Ihnen
        angeforderten Funktion).
      </P>

      <H2>5. Benutzerkonto und Anmeldung</H2>
      <P>
        Plenara befindet sich in einer geschlossenen Testphase; Konten richten wir auf Einladung ein. Für ein Konto verarbeiten wir Ihre E-Mail-Adresse, freiwillig
        Ihren Namen, die freigeschaltete Stufe mit Laufzeit, den Zeitpunkt Ihrer Zustimmung zu den Nutzungsbedingungen und zur Volljährigkeit sowie den Zeitpunkt Ihrer
        letzten Anmeldung.
      </P>
      <P>
        Zur Anmeldung senden wir Ihnen einen Link und einen Code per E-Mail. Beide gelten 15 Minuten und nur einmal; wir speichern sie nur als nicht umkehrbaren Prüfwert.
        Nach der Anmeldung führen wir eine Sitzung auf unserem Server (mit einer aus Ihrer Browserkennung abgeleiteten Gerätebezeichnung wie „Firefox unter Windows“ und
        den Zeitpunkten der Nutzung), damit Sie Ihre angemeldeten Geräte sehen und abmelden können. Eine Sitzung endet nach 30 Tagen ohne Nutzung, spätestens nach 90
        Tagen. Anmeldungen und Fehlversuche protokollieren wir 90 Tage, um Missbrauch zu erkennen.
      </P>
      <P>
        Wenn Sie angemeldet Suchen oder Artikel speichern, Einstellungen ändern oder den Kalender nutzen, legen wir diese Angaben in Ihrem Konto ab. Der Kalender ist
        über eine persönliche, geheime Adresse abrufbar, die Sie jederzeit erneuern können.
      </P>
      <P>
        Wenn Sie eine Benachrichtigung einschalten (Glocke an einer gespeicherten Suche oder einem Vorgang, Wochenbericht, Kalender), gleichen wir neu aufgenommene
        Vorgänge mit Ihren gespeicherten Suchen, Vorgängen und Kalendergebieten ab und schicken Ihnen die Treffer per E-Mail. Damit nichts doppelt kommt, speichern wir
        30 Tage lang, welche Vorgänge wir Ihnen gemeldet haben. Die E-Mails enthalten keine Zählpixel und keine verfolgten Links. Jede E-Mail enthält einen Link zum
        Abbestellen, der ohne Anmeldung wirkt; er gilt 180 Tage. Im Konto können Sie Benachrichtigungen jederzeit aus- und wieder einschalten.
      </P>
      <P>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Kontos und seiner Funktionen); der Nachweis Ihrer Zustimmung und die Protokolle zur Sicherheit
        beruhen auf Art. 6 Abs. 1 lit. f DSGVO. Sie können Ihre Daten im Konto jederzeit exportieren und Ihr Konto löschen.
      </P>

      <H2>6. Cookies und Speicher im Browser</H2>
      <P>Wir setzen nur technisch notwendige Cookies:</P>
      <Ul
        items={[
          "ein Sitzungs-Cookie nach der Anmeldung (enthält nur eine zufällige Kennung, gilt bis zur Abmeldung bzw. dem Ende der Sitzung),",
          "ein kurzlebiges Cookie während der Anmeldung (15 Minuten), damit der Code aus der E-Mail nur im selben Browser gilt.",
        ]}
      />
      <P>
        Im lokalen Speicher Ihres Browsers (localStorage) legen wir außerdem Ihre letzten Suchbegriffe, Darstellungsvorlieben (etwa den dunklen Modus) und, ohne Anmeldung,
        gemerkte Artikel ab. Diese Angaben bleiben auf Ihrem Gerät, bis Sie sich anmelden und ihrer Übernahme ins Konto zustimmen. Sie können sie jederzeit in den
        Einstellungen Ihres Browsers löschen.
      </P>
      <P>
        Beides ist für die von Ihnen gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz, TDDDG);
        eine Einwilligung ist dafür nicht nötig.
      </P>

      <H2>7. E-Mail-Versand und Kontakt</H2>
      <P>
        E-Mails zur Anmeldung, Einladungen, Benachrichtigungen und Hinweise zu Ihrem Konto verschicken wir über unser Postfach bei der IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, als
        Auftragsverarbeiter (Art. 28 DSGVO). Nach dem Versand löschen wir Empfängeradresse und Inhalt aus unserem Postausgang; der Versandvermerk ohne Adresse bleibt 30
        Tage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </P>
      <P>
        Wenn Sie uns per E-Mail schreiben, verarbeiten wir Ihre Adresse und Nachricht, um Ihre Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO). Wir löschen
        die Nachricht, wenn die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten bestehen.
      </P>

      <H2>8. Datenquellen, Verarbeitung der Unterlagen und KI</H2>
      <P>Für die Inhalte von {name} greift ausschließlich unser Server auf folgende Quellen zu. Ihr Browser stellt dabei keine Verbindung zu diesen Diensten her.</P>
      <Ul
        items={[
          <>
            <strong>Ratsinformationssysteme der Kommunen und Kreise</strong> (u. a. OParl-Schnittstellen sowie öffentliche Webseiten von Systemen wie SessionNet, ALLRIS
            und SD.NET): Wir rufen öffentlich bereitgestellte Vorlagen, Sitzungen, Beschlüsse und Dokumente ab, legen die Dokumente auf unserem Server ab und lesen ihren
            Text aus. Diese Unterlagen können Namen von Mandatsträgerinnen und Mandatsträgern, Gremienmitgliedern oder Verwaltungsbeschäftigten enthalten. Die Verarbeitung
            erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist die verständliche Aufbereitung amtlich veröffentlichter Informationen über
            Kommunalpolitik. Wir übernehmen nur, was die Kommune selbst veröffentlicht hat, und verweisen stets auf die Originalquelle.
          </>,
          <>
            <strong>Zusammenfassungen und Einordnung:</strong> Die meisten Zusammenfassungen, Themen und Werte erstellen wir nach festen Regeln auf unserem eigenen Server.
            Ein Teil wird zusätzlich mit KI-Modellen erstellt (derzeit von Anthropic, PBC, San Francisco, USA, und OpenAI). Dabei verarbeiten die Anbieter ausschließlich
            Texte aus den öffentlichen Ratsunterlagen, keine Daten von Besucherinnen und Besuchern oder Kontoinhabern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; eine
            Übermittlung in die USA ist durch das EU-U.S. Data Privacy Framework bzw. Standardvertragsklauseln abgesichert.
          </>,
          <>
            <strong>Kartendaten</strong> des Bundesamts für Kartographie und Geodäsie (VG250) und von Natural Earth sind in die Website eingebunden und werden von unserem
            Server ausgeliefert. Es wird kein externer Kartendienst geladen.
          </>,
        ]}
      />

      <H2>9. Links zu Originalquellen und Teilen</H2>
      <P>
        Artikel verlinken auf Sitzungen und Dokumente in den Ratsinformationssystemen der jeweiligen Kommune. Erst wenn Sie einen solchen Link anklicken, baut Ihr Browser
        eine Verbindung zum Server dieser Kommune bzw. ihres IT-Dienstleisters auf; dort gelten deren Datenschutzbestimmungen.
      </P>
      <P>
        Über die Schaltfläche „Link teilen“ wird die Adresse des Artikels an das Teilen-Menü Ihres Geräts übergeben oder in die Zwischenablage kopiert. Wir erhalten dabei
        keine Daten; an wen Sie den Link weitergeben, entscheiden Sie selbst in der jeweiligen App.
      </P>

      <H2>10. Speicherdauer</H2>
      <Ul
        items={[
          "Konto und Kontoinhalte: bis zur Löschung des Kontos. Ohne Anmeldung seit 24 Monaten erhalten Sie einen Hinweis; meldet sich niemand, löschen wir das Konto 30 Tage später.",
          "Sitzungen: 30 Tage ohne Nutzung, spätestens 90 Tage.",
          "Link und Code zur Anmeldung: 15 Minuten; Prüfwerte zur Begrenzung von Anmeldeversuchen: ein Tag.",
          "Protokoll der Anmeldungen und Fehlversuche: 90 Tage.",
          "Versandvermerke ohne Adresse und Inhalt: 30 Tage.",
          "Technische Protokolle der Anwendung: 7 Tage.",
          "Sicherungskopien der Kontodaten: verschlüsselt, höchstens 7 Tage; gelöschte Konten werden beim Zurückspielen einer Sicherung erneut gelöscht.",
          "Inhalte aus Ratsinformationssystemen: so lange, wie sie für die Darstellung kommunalpolitischer Vorgänge relevant sind oder bis die Kommune sie zurückzieht.",
        ]}
      />

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
        Export und Löschung Ihres Kontos können Sie selbst im Konto auslösen. Für alles Weitere schreiben Sie an die oben genannte Adresse; wir antworten innerhalb eines
        Monats. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), etwa bei der Landesbeauftragten für Datenschutz und
        Informationsfreiheit Nordrhein-Westfalen, Kavalleriestraße 2–4, 40213 Düsseldorf.
      </P>

      <H2>12. Keine automatisierte Entscheidungsfindung</H2>
      <P>Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt.</P>

      <H2>13. Änderungen</H2>
      <P>Wir passen diese Datenschutzerklärung an, wenn sich die Website oder die Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung.</P>
    </>
  );
}

/** Inhaltsverzeichnis mit Sprungmarken (Handy: Liste oben; breiter Desktop: fest neben dem Text) aus den Überschriften des Textes; per DOM, weil der Text selbst feste Komponenten sind */
export function useInhalt(ref: React.RefObject<HTMLDivElement | null>, on: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!on || !root) return;
    const hs = [...root.querySelectorAll("h2")];
    const nav = document.createElement("nav");
    nav.className = "sm:hidden";
    nav.setAttribute("aria-label", "Inhalt");
    nav.style.cssText = "margin:0 0 8px;border-bottom:1px solid var(--rm-c200)";
    hs.forEach((h, i) => {
      h.id = h.id || `abschnitt-${i + 1}`;
      h.style.scrollMarginTop = "72px";
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      a.style.cssText = "display:flex;align-items:center;min-height:44px;font-size:14px;color:var(--rm-c900);text-decoration:none;border-top:1px solid var(--rm-c100)";
      nav.appendChild(a);
    });
    root.insertBefore(nav, root.firstChild);
    /* Breiter Desktop: Verzeichnis rechts neben dem Text, bleibt beim Scrollen stehen */
    const side = document.createElement("nav");
    side.className = "ri-toc";
    side.setAttribute("aria-label", "Inhalt");
    const inner = document.createElement("div");
    hs.forEach((h) => { const a = document.createElement("a"); a.href = `#${h.id}`; a.textContent = h.textContent; inner.appendChild(a); });
    side.appendChild(inner);
    const pos = root.style.position;
    root.style.position = "relative";
    root.appendChild(side);
    return () => { nav.remove(); side.remove(); root.style.position = pos; };
  }, [ref, on]);
}

export function LegalPage({ kind }: { kind: "impressum" | "datenschutz" }) {
  /* Gleicher Aufbau wie die Info-Seiten: Kopf mit Zurück-Link, Text ohne Rahmen */
  const imp = kind === "impressum";
  const text = useRef<HTMLDivElement>(null);
  useInhalt(text, !imp);
  return (
    <main id="inhalt" className="ri">
      <PageHead icon={imp ? "fileText" : "shieldCheck"} label="Rechtliches" name={imp ? "Impressum" : "Datenschutz"} title={imp ? "Impressum" : "Datenschutzerklärung"} />
      <section className="ri-sec ri-sec--tight">
        <div ref={text} className="max-w-[80ch] [&>h2:first-child]:mt-0">{imp ? <Impressum /> : <Datenschutz />}</div>
      </section>
    </main>
  );
}
