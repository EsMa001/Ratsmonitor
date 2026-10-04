import Link from "next/link";
import type { CSSProperties } from "react";
import { useBrand } from "../lib/brand";
import { DarkCta, HitPreview, PageHead, SearchTermButton, useOpenSearch } from "./blocks";
import { BRANCHEN, NOTIFY_STAT, type Branche } from "./content";
import { Icon } from "./icons";

export function BranchenPage() {
  const openSearch = useOpenSearch();
  const { name } = useBrand();
  return (
    <>
      <PageHead icon="layoutGrid" label="Übersicht" name="Branchen & Anwendungsfälle" title={`Wer ${name} nutzt`} lead="Acht Branchen. Wählen Sie Ihre, um zu sehen, welche Beschlüsse für Sie zählen." />
      <section className="ri-band">
        <div className="ri-grid4">
          {BRANCHEN.map((b) => (
            <Link key={b.slug} href={`/branchen/${b.slug}`} className="ri-bc">
              <Icon name={b.icon} size={28} className="ri-bc__icon" />
              <h3>{b.name}</h3>
              <p className="ri-bc__benefit">{b.benefits[0][1]}</p>
              <p className="ri-bc__for">Für {b.audience}</p>
              <span className="ri-bc__more">Mehr erfahren →</span>
            </Link>
          ))}
        </div>
      </section>
      <DarkCta
        title="Ihre Branche ist nicht dabei?"
        sub="Die Suche funktioniert für jedes kommunale Thema. Starten Sie einfach mit einem eigenen Begriff."
        action={
          <button type="button" className="ri-btn ri-btn--inv" onClick={() => openSearch()}>
            Suche starten
          </button>
        }
      />
    </>
  );
}

function Timeline({ b }: { b: Branche }) {
  const { name } = useBrand();
  const first = Math.min(...b.reported);
  const last = Math.max(...b.reported);
  return (
    <ol className="ri-tl" style={{ "--tl-from": `${first * 20}%`, "--tl-span": `${(last - first + 1) * 20}%` } as CSSProperties}>
      {b.steps.map(([icon, title], i) => {
        const reported = b.reported.includes(i);
        return (
          <li key={title + i} className={"ri-tl__step" + (reported ? "" : " ri-tl__step--out")}>
            <span className="ri-tl__icon">
              <Icon name={icon} size={18} />
            </span>
            <span className="ri-tl__label">{reported ? `${name} meldet` : "Außerhalb des Rats"}</span>
            <span className="ri-tl__title">{title}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function BranchePage({ b }: { b: Branche }) {
  const { name } = useBrand();
  const term = b.keywords[0];
  return (
    <>
      <PageHead icon={b.icon} label="Branche" name={b.name} title={b.title} lead={b.intro} aside={<HitPreview term={term} example={b.example} />}>
        <div className="ri-actions">
          <SearchTermButton term={term} />
        </div>
        <p className="ri-for">Für {b.audience}</p>
      </PageHead>

      <section className="ri-band">
        <div className="ri-grid3">
          {b.benefits.map(([icon, title, text]) => (
            <div key={title} className="ri-bcard">
              <Icon name={icon} size={28} className="ri-bcard__icon" />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ri-sec">
        <h2 className="ri-h2">{b.flowTitle}</h2>
        <p className="ri-sub">{name} meldet bei jedem Schritt, zu dem die Kommune ein Dokument veröffentlicht.</p>
        <Timeline b={b} />
        <div className="ri-vp">
          <h3 className="ri-vp__label">Ihr Vorsprung</h3>
          <div>
            <p className="ri-vp__text">{b.advantage}</p>
            <div className="ri-vp__stats">
              <div>
                <span className="ri-vp__num">{b.stat[0]}</span>
                <span className="ri-vp__lab">{b.stat[1]}</span>
                <span className="ri-vp__note">Beispielwerte, fiktive Testdaten</span>
              </div>
              <div>
                <span className="ri-vp__num">{NOTIFY_STAT[0]}</span>
                <span className="ri-vp__lab">{NOTIFY_STAT[1]}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-eyebrow">Worauf {name} für Sie achtet</h2>
        <p className="ri-wr">
          {b.watch.map((w, i) => (
            <span key={w}>
              {w}
              {i < b.watch.length - 1 && (
                <span className="ri-wr__sep" aria-hidden="true">
                  ·
                </span>
              )}{" "}
            </span>
          ))}
        </p>
      </section>

      <DarkCta title={b.closing} pills={b.keywords} action={<SearchTermButton term={term} light />} />
    </>
  );
}
