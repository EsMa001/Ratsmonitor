import { BETREIBER } from "../lib/betreiber";
import { PageHead } from "./blocks";
import { H2, P } from "./LegalText";

/* Entwurf nach dem gesetzlichen Muster für Dienstleistungsverträge (Anlage 1 zu Art. 246a § 1 Abs. 2 Satz 2 EGBGB),
   nicht anwaltlich geprüft. Der Wortlaut des Musters soll nicht verändert werden. */
function Kontakt() {
  return (
    <>
      {BETREIBER.name}, {BETREIBER.strasse}, {BETREIBER.ort}, E-Mail: {BETREIBER.email}
    </>
  );
}

const box = { margin: "0 0 14px", padding: "18px 20px", border: "1px solid #e2e8f0", borderRadius: 10 } as const;
const line = { margin: "0 0 10px", fontSize: 16, lineHeight: 1.7, color: "#64748b" } as const;

export function WiderrufPage() {
  return (
    <>
      <PageHead icon="fileText" label="Rechtliches" name="Widerruf" title="Widerrufsbelehrung" lead="Gilt für Verbraucher beim Abschluss eines kostenpflichtigen Tarifs (Pro, Enterprise)." />
      <section className="ri-sec ri-sec--tight">
        <div className="max-w-[80ch] [&>h2:first-child]:mt-0">
          <P>Stand: Oktober 2026</P>

          <H2>Widerrufsrecht</H2>
          <P>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</P>
          <P>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</P>
          <P>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (<Kontakt />) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über
            Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht
            vorgeschrieben ist.
          </P>
          <P>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </P>

          <H2>Folgen des Widerrufs</H2>
          <P>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem
            Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe
            Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem
            Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
          </P>
          <P>
            Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil
            der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im
            Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.
          </P>

          <H2>Vorzeitiges Erlöschen des Widerrufsrechts</H2>
          <P>
            Das Widerrufsrecht erlischt bei einem Vertrag zur Erbringung von Dienstleistungen, wenn wir die Dienstleistung vollständig erbracht haben und mit der
            Ausführung der Dienstleistung erst begonnen haben, nachdem Sie dazu Ihre ausdrückliche Zustimmung gegeben haben und gleichzeitig Ihre Kenntnis davon bestätigt
            haben, dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlieren.
          </P>

          <H2>Muster-Widerrufsformular</H2>
          <P>Wenn Sie den Vertrag widerrufen wollen, können Sie dieses Formular ausfüllen und an uns zurücksenden.</P>
          <div style={box}>
            <p style={line}>
              An <Kontakt />:
            </p>
            <p style={line}>
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*): Tarif ______________
            </p>
            <p style={line}>Bestellt am (*) / erhalten am (*): ______________</p>
            <p style={line}>Name des/der Verbraucher(s): ______________</p>
            <p style={line}>Anschrift des/der Verbraucher(s): ______________</p>
            <p style={line}>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________</p>
            <p style={line}>Datum: ______________</p>
            <p style={{ ...line, margin: 0, fontSize: 14 }}>(*) Unzutreffendes streichen.</p>
          </div>
        </div>
      </section>
    </>
  );
}
