import type { ReactNode } from "react";
import Link from "next/link";
import { useBrand } from "../lib/brand";
import { BETREIBER, betreiberAdresse } from "../lib/betreiber";
import { PageHead } from "./blocks";
import { H2, P, Ul } from "./LegalText";

/* Entwurf, nicht anwaltlich geprüft. Offene Punkte stehen in docs/recht/pflichten-und-avv.md und in der To-Do-Liste.
   Die Tarife entsprechen info/content.ts (PLANS): Basic kostenlos, Pro 9,99 €, Enterprise 49,99 € je Monat inkl. MwSt. */
/* Absatz: Text oder Text mit Aufzählung darunter (kein <ul> in <p>) */
type Para = ReactNode | { text: string; list: string[] };
type Section = { title: string; paras: Para[] };
const isList = (x: Para): x is { text: string; list: string[] } => typeof x === "object" && x !== null && "list" in x;

const link = (href: string, text: string) => (
  <Link href={href} className="ri-link">
    {text}
  </Link>
);

function sections(brand: string): Section[] {
  return [
    {
      title: "Geltungsbereich",
      paras: [
        `Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Plattform ${brand} und für alle Verträge über ihre Tarife zwischen ${betreiberAdresse()}, vertreten durch ihre Gesellschafter (siehe Impressum), nachfolgend „wir“, und Ihnen als Nutzerin oder Nutzer, nachfolgend „Sie“.`,
        "Verbraucher ist, wer den Vertrag zu Zwecken abschließt, die überwiegend weder seiner gewerblichen noch seiner selbständigen beruflichen Tätigkeit zugerechnet werden können (§ 13 BGB). Unternehmer ist, wer in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit handelt (§ 14 BGB). Regelungen, die nur für eine der beiden Gruppen gelten, sind ausdrücklich gekennzeichnet.",
        "Abweichende, entgegenstehende oder ergänzende Geschäftsbedingungen von Ihnen werden nicht Vertragsbestandteil, es sei denn, wir stimmen ihrer Geltung ausdrücklich in Textform zu.",
        "Vertragssprache ist Deutsch.",
      ],
    },
    {
      title: "Leistungen",
      paras: [
        `${brand} ist ein Informationsdienst. Wir bereiten öffentlich zugängliche Informationen aus Ratsinformationssystemen von Kommunen und Kreisen auf, insbesondere Sitzungen, Vorlagen, Beschlüsse und zugehörige Dokumente, und machen sie durchsuchbar. Je nach Tarif umfasst das die Suche mit Filtern, die Kartenansicht, gespeicherte Suchen und Artikel, E-Mail-Benachrichtigungen und den Sitzungskalender.`,
        "Es gibt die Tarife Basic (kostenlos), Pro und Enterprise. Maßgeblich sind Umfang und Grenzen (zum Beispiel die Zahl gespeicherter Suchen, Artikel und Benachrichtigungen sowie die Zahl weiterer Empfänger), die auf der Seite „Preise“ zum Zeitpunkt Ihres Vertragsschlusses angegeben sind. Zusatzleistungen, zum Beispiel individuelle Analysen, erbringen wir nur nach gesonderter Vereinbarung.",
        "Wir geben Inhalte Dritter wieder. Die Zusammenfassungen und thematischen Einordnungen werden teilweise automatisiert, auch mit Hilfe künstlicher Intelligenz, erstellt und können Fehler enthalten. Maßgeblich sind ausschließlich die verlinkten Originalunterlagen der jeweiligen Kommune. Wir erbringen keine Rechts-, Steuer- oder sonstige Beratung.",
        "Wir schulden keine lückenlose Erfassung aller Sitzungen, Vorlagen oder Beschlüsse. Die Daten hängen davon ab, was Kommunen und ihre IT-Dienstleister veröffentlichen und technisch bereitstellen. Quellen können sich ändern oder ausfallen. Benachrichtigungen sind ein Hilfsmittel und keine Zusicherung, dass Sie über jeden Vorgang oder rechtzeitig informiert werden. Fristen, Genehmigungen, Ausschreibungen und Rechtsmittel müssen Sie anhand der Originalunterlagen selbst prüfen.",
        "Wir bemühen uns um eine hohe Verfügbarkeit des Dienstes. Wartungsarbeiten, technische Störungen und Ausfälle bei Dienstleistern können die Nutzung zeitweise einschränken. Eine bestimmte Verfügbarkeit schulden wir nur, soweit sie individuell vereinbart ist.",
        "Wir dürfen Leistungen ändern, wenn dafür ein triftiger Grund besteht (zum Beispiel Änderungen bei den Datenquellen, der Rechtslage, der Sicherheit oder der Technik), Ihnen dadurch keine zusätzlichen Kosten entstehen und wir Sie klar und verständlich informieren. Beeinträchtigt eine Änderung Ihre Nutzung mehr als nur geringfügig, informieren wir Sie mindestens 14 Tage vorher in Textform. In diesem Fall können Sie den Vertrag innerhalb von 30 Tagen nach der Information oder, falls später, nach der Änderung kostenfrei kündigen.",
      ],
    },
    {
      title: "Registrierung und Vertragsschluss",
      paras: [
        "Für alle Tarife ist ein Benutzerkonto erforderlich. Mit dem Absenden des Registrierungsformulars geben Sie ein Angebot zum Abschluss des Nutzungsvertrags ab. Wir nehmen es an, indem wir Ihr Konto nach Bestätigung Ihrer E-Mail-Adresse freischalten.",
        "Die Suche ohne Konto ist kostenlos und im Umfang eingeschränkt möglich, zum Beispiel mit einer begrenzten Zahl von Treffern je Suche. Dafür gelten die Abschnitte 2, 7, 8 und 9 entsprechend.",
        "Kostenpflichtige Tarife buchen Sie über den Bestellvorgang. Die Darstellung der Tarife auf der Website ist noch kein verbindliches Angebot. Mit dem Klick auf die Schaltfläche „zahlungspflichtig bestellen“ geben Sie ein verbindliches Angebot ab. Vor dem Absenden können Sie Ihre Eingaben prüfen und über die Schaltflächen im Bestellvorgang oder die Funktionen Ihres Browsers korrigieren. Wir bestätigen den Eingang Ihrer Bestellung per E-Mail. Der Vertrag kommt zustande, wenn wir die Bestellung annehmen oder den Tarif freischalten.",
        "Nach Vertragsschluss senden wir Ihnen die Vertragsdaten und diese AGB per E-Mail zu. Die AGB können Sie jederzeit auf dieser Seite einsehen, speichern und ausdrucken.",
        "Das Angebot richtet sich an Personen ab 18 Jahren. Ihre Angaben bei der Registrierung müssen wahr und vollständig sein. Bitte halten Sie sie aktuell.",
        "Ihr Konto ist nur für Sie bestimmt. Halten Sie Ihre Zugangsdaten geheim und schützen Sie sie vor dem Zugriff Dritter. Wenn Sie Anhaltspunkte für einen Missbrauch haben, informieren Sie uns bitte unverzüglich.",
      ],
    },
    {
      title: "Preise und Zahlung",
      paras: [
        "Basic ist kostenlos. Für Pro und Enterprise gelten die Preise, die im Bestellvorgang und auf der Seite „Preise“ angegeben sind. Alle Preise sind Endpreise in Euro einschließlich der gesetzlichen Umsatzsteuer.",
        "Der Preis wird monatlich im Voraus berechnet. Die erste Zahlung wird mit Vertragsschluss fällig, jede weitere jeweils zum selben Tag des Folgemonats.",
        "Sie können die im Bestellvorgang angebotenen Zahlungsarten nutzen. Die Zahlung wird über den Zahlungsdienstleister [Name des Zahlungsdienstleisters] abgewickelt. Rechnungen erhalten Sie elektronisch, per E-Mail oder in Ihrem Konto. Für Unternehmen und Organisationen stimmen wir Abrechnung und Rechnungsstellung auf Anfrage individuell ab.",
        "Kommen Sie mit einer Zahlung in Verzug, gelten die gesetzlichen Regeln. Nach Mahnung und angemessener Fristsetzung dürfen wir den Zugriff auf die kostenpflichtigen Funktionen sperren, bis der Rückstand ausgeglichen ist.",
        "Wir können die Preise für bestehende Verträge nur mit Ihrer Zustimmung ändern. Eine geplante Änderung teilen wir Ihnen mindestens sechs Wochen vor Beginn in Textform mit. Stimmen Sie nicht ausdrücklich zu, läuft der Vertrag zu den bisherigen Preisen weiter. Wir können ihn dann zum Ende des laufenden Abrechnungsmonats mit einer Frist von einem Monat ordentlich kündigen.",
      ],
    },
    {
      title: "Laufzeit und Kündigung",
      paras: [
        "Basic läuft auf unbestimmte Zeit. Sie können es jederzeit beenden, indem Sie Ihr Konto löschen. Wir können Basic mit einer Frist von 14 Tagen kündigen.",
        "Pro und Enterprise laufen auf unbestimmte Zeit und werden monatlich abgerechnet. Es gibt keine Mindestlaufzeit. Sie können jederzeit zum Ende des laufenden Abrechnungsmonats kündigen und den Tarif bis dahin weiter nutzen.",
        "Sie können die Kündigung über die Kündigungsschaltfläche auf der Website, in Ihrem Konto oder in Textform (zum Beispiel per E-Mail) erklären.",
        "Wir können Pro und Enterprise mit einer Frist von einem Monat zum Ende eines Abrechnungsmonats kündigen. Das Recht beider Seiten zur Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt für uns insbesondere vor, wenn Sie wesentlich gegen Abschnitt 7 verstoßen oder trotz Mahnung und Fristsetzung weiter mit der Zahlung in Verzug sind.",
        "Ein Wechsel in einen höheren Tarif ist jederzeit möglich. Einzelheiten zur Abrechnung zeigen wir Ihnen vor dem Wechsel an.",
        "Mit dem Vertragsende endet der Zugriff auf die Funktionen des beendeten Tarifs. Ihre Daten löschen wir nach den Regeln unserer Datenschutzerklärung.",
      ],
    },
    {
      title: "Widerrufsrecht für Verbraucher",
      paras: [
        <>
          Wenn Sie Verbraucher sind, haben Sie bei kostenpflichtigen Tarifen ein gesetzliches Widerrufsrecht. Einzelheiten und ein Muster-Widerrufsformular finden Sie in der {link("/widerruf", "Widerrufsbelehrung")}.
        </>,
      ],
    },
    {
      title: "Zulässige Nutzung und Nutzungsrechte",
      paras: [
        `Wir räumen Ihnen für die Dauer des Vertrags ein einfaches, nicht übertragbares Recht ein, ${brand} für Ihre eigenen Zwecke zu nutzen. Im Tarif Enterprise gilt das für Ihre Organisation und die von Ihnen benannten Empfänger.`,
        "Einzelne Treffer, Zusammenfassungen, Exporte und Verweise dürfen Sie für eigene, auch geschäftliche, Zwecke und in üblichem Umfang unter Angabe der Quelle verwenden. Die Rechte der Kommunen und Dritter an den Originalunterlagen bleiben unberührt.",
        {
          text: "Nicht gestattet ist insbesondere:",
          list: [
            "das automatisierte oder massenhafte Auslesen, Kopieren oder Spiegeln von Inhalten oder der Datenbank, zum Beispiel durch Crawler oder Scraper,",
            "das Weitergeben oder Weiterverkaufen des Zugangs oder der Daten in größerem Umfang,",
            "das Umgehen technischer Schutzmaßnahmen oder der Grenzen Ihres Tarifs,",
            "Handlungen, die den Dienst überlasten oder stören,",
            "die Nutzung von Inhalten zur gezielten Beobachtung einzelner Personen oder zur Erstellung von Personenprofilen.",
          ],
        },
        `Die Aufbereitung, die Struktur und die Datenbank von ${brand} sowie unsere Marken und Logos sind geschützt. Soweit hier nichts anderes bestimmt ist, erhalten Sie daran keine Rechte.`,
        "Im Tarif Enterprise können Sie weitere Empfänger für Benachrichtigungen angeben. Sie versichern, dass diese Personen damit einverstanden sind und Sie ihre E-Mail-Adressen dafür verwenden dürfen. Sie stellen sicher, dass die Empfänger die Regeln dieses Abschnitts einhalten.",
        "Bei einem Verstoß dürfen wir Ihr Konto nach vorheriger Abmahnung vorübergehend oder dauerhaft sperren. Bei schwerwiegenden Verstößen ist das auch ohne Abmahnung möglich.",
      ],
    },
    {
      title: "Haftung",
      paras: [
        "Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz, bei arglistig verschwiegenen Mängeln und soweit wir eine Garantie übernommen haben.",
        "Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht ist unsere Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt. Wesentlich sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung Sie regelmäßig vertrauen dürfen. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.",
        "Für die kostenlose Nutzung ohne Konto und den kostenlosen Tarif Basic haften wir nur bei Vorsatz und grober Fahrlässigkeit. Absatz 1 bleibt unberührt.",
        "Für Inhalte Dritter, insbesondere der Kommunen, übernehmen wir keine Gewähr für Richtigkeit, Vollständigkeit und Aktualität. Das gilt nicht in den Fällen der Absätze 1 und 2. Entscheidungen auf Grundlage der Informationen treffen Sie in eigener Verantwortung und prüfen dazu die Originalunterlagen.",
        "Die Haftungsbeschränkungen gelten auch zugunsten unserer Gesellschafter, Mitarbeiter und Erfüllungsgehilfen.",
      ],
    },
    {
      title: "Datenschutz",
      paras: [<>Wie wir personenbezogene Daten verarbeiten, steht in der {link("/datenschutz", "Datenschutzerklärung")}.</>],
    },
    {
      title: "Änderungen dieser AGB",
      paras: [
        "Wir können diese AGB mit Wirkung für die Zukunft ändern, soweit das für Sie zumutbar ist, insbesondere wegen einer geänderten Rechtslage oder um Regelungslücken zu schließen. Leistungen und Preise bleiben davon unberührt, dafür gelten die Abschnitte 2 und 4.",
        "Wir informieren Sie mindestens sechs Wochen vor Wirksamwerden in Textform und weisen Sie auf Ihr Widerspruchsrecht hin. Widersprechen Sie nicht innerhalb dieser Frist, gelten die geänderten AGB. Widersprechen Sie, läuft der Vertrag zu den bisherigen Bedingungen weiter. Wir können ihn dann ordentlich kündigen.",
      ],
    },
    {
      title: "Übertragung auf eine Nachfolgegesellschaft",
      paras: [
        `Wir dürfen den Vertrag auf eine Gesellschaft übertragen, die den Betrieb von ${brand} übernimmt, insbesondere auf eine Unternehmergesellschaft (haftungsbeschränkt) oder GmbH, an der die bisherigen Gesellschafter beteiligt sind. Wir informieren Sie darüber mindestens vier Wochen vorher in Textform. Bis zum Zeitpunkt der Übertragung können Sie den Vertrag in diesem Fall kostenfrei kündigen.`,
      ],
    },
    {
      title: "Schlussbestimmungen",
      paras: [
        "Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht zwingende Verbraucherschutzvorschriften des Staates entzogen werden, in dem Sie Ihren gewöhnlichen Aufenthalt haben.",
        `Sind Sie Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand für alle Streitigkeiten aus dem Vertrag der Sitz unserer Gesellschaft (${BETREIBER.sitz}).`,
        "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
        "Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt der Vertrag im Übrigen wirksam. An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung.",
      ],
    },
  ];
}

export function AgbPage() {
  const { name } = useBrand();
  return (
    <>
      <PageHead icon="fileText" label="Rechtliches" name="AGB" title="Allgemeine Geschäftsbedingungen" />
      <section className="ri-sec ri-sec--tight">
        <div className="max-w-[80ch] [&>h2:first-child]:mt-0">
          <P>Stand: Oktober 2026</P>
          {sections(name).map((s, i) => (
            <div key={s.title}>
              <H2>
                {i + 1}. {s.title}
              </H2>
              {s.paras.map((para, j) => {
                const number = s.paras.length > 1 && <span style={{ color: "var(--rm-c900,#0f172a)" }}>({j + 1}) </span>;
                return isList(para) ? (
                  <div key={j}>
                    <P>
                      {number}
                      {para.text}
                    </P>
                    <Ul items={para.list} />
                  </div>
                ) : (
                  <P key={j}>
                    {number}
                    {para}
                  </P>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
