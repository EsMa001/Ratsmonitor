import Link from "next/link";
import { useBrand } from "../lib/brand";
import { DarkCta, PageHead } from "./blocks";

/* Drei Wege zur Benachrichtigung; jeweils mit dem Ort, an dem man sie einstellt */
const WAYS: [string, string, string, string][] = [
  ["Gespeicherte Suche", "Speichern Sie eine Suche mit dem Herz und schalten Sie die Glocke ein. Sie erfahren von jedem neuen Treffer zu Ihrem Thema, Ort oder Umkreis.", "/konto/suchen", "Zu den gespeicherten Suchen"],
  ["Gespeicherter Artikel", "Folgen Sie einem einzelnen Vorgang mit der Glocke. Sie erfahren, sobald er weiter beraten, vertagt oder beschlossen wird.", "/konto/artikel", "Zu den gespeicherten Artikeln"],
  ["Kalender", "Legen Sie Ihre Gebiete fest, etwa Ihr Vertriebsgebiet mit Umkreis. Sie erfahren von neuen Sitzungsterminen, bevor die Tagesordnung verhandelt wird.", "/konto/kalender", "Zum Kalender"],
];

/* Was eine rechtzeitige Information wert sein kann: Beispiele aus den Use Cases */
const VALUE: [string, string][] = [
  ["Aufträge, bevor sie ausgeschrieben werden", "Wenn ein Ausschuss eine Sanierung oder einen neuen Entsorgungsvertrag beschließt, steht die Ausschreibung oft Monate später an. Wer es früh weiß, plant Kapazitäten und Angebot rechtzeitig, statt unter Zeitdruck oder gar nicht mitzubieten."],
  ["Fehlinvestitionen vermeiden", "Eine Veränderungssperre oder ein neuer Bebauungsplan kann den Wert eines Grundstücks deutlich verändern. Wer davon vor dem Kauf erfährt, verhandelt anders oder lässt es."],
  ["Fristen nicht verpassen", "Auslegungen, Stellungnahmen und Konzessionsvergaben haben feste Fristen. Eine verpasste Frist lässt sich nicht nachholen. Die Benachrichtigung kommt, solange noch Zeit ist."],
  ["Recherchezeit sparen", "Statt regelmäßig dutzende Ratsinformationssysteme zu öffnen, kommt das Relevante zu Ihnen. Das spart jede Woche Stunden, die Sie für die eigentliche Arbeit nutzen."],
];

/** Erklärseite: Benachrichtigungen laufen über gespeicherte Suchen, Artikel und den Kalender */
export function BenachrichtigungenPage() {
  const { name } = useBrand();
  return (
    <>
      <PageHead
        icon="bell"
        label="Funktionen"
        name="Benachrichtigungen"
        title={<>Früher wissen.<br />Bares Geld verdienen.</>}
        lead={`Kommunale Entscheidungen entscheiden über Aufträge, Grundstücke und Standorte. ${name} meldet sich, sobald zu Ihren Themen und Gebieten etwas beraten wird: per E-Mail, sofort, täglich oder wöchentlich.`}
      />

      <section className="ri-sec">
        <h2 className="ri-h2">Was eine rechtzeitige Nachricht wert ist</h2>
        <div className="ri-points ri-points--2">
          {VALUE.map(([t, p], i) => (
            <div key={t} className="ri-point">
              <span className="ri-point__num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ri-sec">
        <h2 className="ri-h2">So funktioniert es</h2>
        <p className="ri-sub">Es gibt keine eigene Einstellungsseite: Sie schalten die Benachrichtigung direkt dort ein, wo Sie etwas beobachten.</p>
        <table className="w-full border-collapse text-left" style={{ marginTop: 24 }}>
          <tbody>
            {WAYS.map(([t, p, href, link]) => (
              <tr key={t} className="border-b border-slate-200 align-top last:border-b-0">
                <th scope="row" className="w-[30%] py-4 pr-6 text-[16px] font-semibold text-slate-900">{t}</th>
                <td className="py-4 text-[16px] leading-relaxed text-slate-500">
                  {p}
                  <br />
                  <Link href={href} className="text-[14px] text-teal-600 no-underline hover:underline">{link} →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DarkCta
        title="Starten Sie mit Ihrer ersten Benachrichtigung"
        sub="Suchen, Herz setzen, Glocke einschalten. Das dauert keine Minute."
        action={
          <Link href="/" className="ri-btn ri-btn--inv">
            Zur Suche
          </Link>
        }
      />
    </>
  );
}
