import Link from "next/link";
import { DarkCta, PageHead, QaItem, Rich } from "./blocks";
import { COMPARE, PLANS, PRICE_FAQ } from "./content";
import { Icon } from "./icons";

export function PreisePage() {
  return (
    <>
      <PageHead
        icon="tag"
        label="Tarife"
        name="Preise & Tarife"
        title={
          <>
            Einfache Preise.
            <br />
            Jederzeit kündbar.
          </>
        }
        lead="Durchsuchen Sie über 4.500 Ratsinformationssysteme und lassen Sie sich per E-Mail informieren, sobald zu Ihrem Thema etwas beschlossen wird."
      />
      <section className="ri-sec ri-sec--prices">
        <div className="ri-prices">
          {PLANS.map((p) => {
            const hl = p.id === "pro";
            return (
              <article key={p.id} className={"ri-pk" + (hl ? " ri-pk--hl" : "")}>
                {hl && <span className="ri-pk__badge">Beliebt</span>}
                <h2>{p.name}</h2>
                <p className="ri-pk__desc">{p.desc}</p>
                <div className="ri-pk__price">
                  <span className="ri-pk__amount">{p.amount}</span>
                  <span className="ri-pk__unit">{p.unit}</span>
                </div>
                <span className="ri-pk__note">{p.note}</span>
                <hr className="ri-pk__hr" />
                <ul className="ri-pk__items">
                  {p.items.map(([icon, text]) => (
                    <li key={text}>
                      <Icon name={icon} size={15} />
                      <span>
                        <Rich text={text} />
                      </span>
                    </li>
                  ))}
                </ul>
                <hr className="ri-pk__hr" />
                <h3 className="ri-pk__label">Features</h3>
                <ul className="ri-checks">
                  {p.features.map((f) => (
                    <li key={f.text}>
                      <Icon name={f.plus ? "plus" : "check"} size={14} />
                      <span>
                        <Rich text={f.text} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="ri-pk__cta">
                  <Link href={`/registrieren?tarif=${p.id}`} className={"ri-btn ri-btn--block " + (hl ? "ri-btn--dark" : "ri-btn--light")}>
                    {p.cta} →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <h2 className="ri-h2 ri-h2--md ri-h2--gap">Alle Leistungen im Vergleich</h2>
        <table className="ri-table">
          <thead>
            <tr>
              <th className="ri-table__first">
                <span className="sr-only">Leistung</span>
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Preis</th>
              {PLANS.map((p) => (
                <td key={p.id}>
                  {p.amount}
                  {p.id !== "free" && <small> {p.unit}</small>}
                </td>
              ))}
            </tr>
            {COMPARE.map(([label, ...cells]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cells.map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="ri-h2 ri-h2--md ri-h2--gap">Fragen zu Preisen</h2>
        <div className="ri-faq-list ri-faq-list--top">
          {PRICE_FAQ.map((qa) => (
            <QaItem key={qa.q} qa={qa} />
          ))}
        </div>
      </section>
      <DarkCta
        title="Starten Sie kostenlos"
        sub="Ohne Zahlungsdaten. Upgrade jederzeit möglich."
        action={
          <Link href="/registrieren?tarif=free" className="ri-btn ri-btn--inv">
            Konto erstellen
          </Link>
        }
      />
    </>
  );
}
