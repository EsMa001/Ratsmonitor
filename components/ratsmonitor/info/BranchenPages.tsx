import Link from "next/link";
import type { CSSProperties } from "react";
import { useBrand } from "../lib/brand";
import { DarkCta, HitPreview, PageHead, SearchTermButton, useOpenSearch } from "./blocks";
import { BRANCHEN, NOTIFY_STAT, type Branche } from "./content";
import { Icon } from "./icons";

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
  const openBenefit = useOpenSearch();
  return (
    <>
      <PageHead icon={b.icon} label="Use Case" name={b.name} title={b.title} lead={b.intro} aside={<HitPreview term={term} example={b.example} />}>
        <div className="ri-actions">
          <SearchTermButton term={term} />
        </div>
        <p className="ri-for">Für {b.audience}</p>
      </PageHead>

      <section className="ri-band">
        <div className="ri-grid3">
          {/* Jede Kachel startet eine echte Suche mit einem passenden Begriff der Branche */}
          {b.benefits.map(([icon, title, text, term]) => {
            return (
              <button key={title} type="button" onClick={() => openBenefit(term)} className="ri-bcard flex cursor-pointer flex-col text-left">
                <Icon name={icon} size={28} className="ri-bcard__icon" />
                <h3>{title}</h3>
                <p>{text}</p>
                {/* Sieht aus wie die kleinen Such-Buttons; die ganze Kachel startet die Suche */}
                <span className="mt-auto pt-4">
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-white pl-3 pr-2.5 shadow-card">
                    <Icon name="search" size={15} className="flex-none text-slate-500" />
                    <span className="text-[14px] text-slate-900">{term}</span>
                    <span className="text-[14px] text-teal-600">→</span>
                  </span>
                </span>
              </button>
            );
          })}
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
        {/* Gleiche Überschrift wie die anderen Abschnitte; Themen als Zeile mit Häkchen, nicht auf die volle Breite gestreckt */}
        <h2 className="ri-h2">Worauf {name} für Sie achtet</h2>
        {/* Je Thema ein konkreter Anwendungsfall: zwei Spalten, nur Zeilenlinien */}
        <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full border-collapse text-left" style={{ marginTop: 24 }}>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="w-[34%] py-3 pr-6 text-[12px] font-normal uppercase tracking-wide text-slate-500">Thema</th>
              <th scope="col" className="py-3 text-[12px] font-normal uppercase tracking-wide text-slate-500">Ihr Nutzen mit {name}</th>
            </tr>
          </thead>
          <tbody>
            {b.watch.map((w, i) => (
              <tr key={w} className="border-b border-slate-200 align-top last:border-b-0">
                <th scope="row" className="py-4 pr-6 text-[16px] font-semibold text-slate-900">
                  <span className="inline-flex items-start gap-2.5">
                    <Icon name="check" size={18} className="mt-0.5 flex-none text-teal-600" />
                    {w}
                  </span>
                </th>
                <td className="py-4 text-[16px] leading-relaxed text-slate-500">{b.useCases?.[i] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <DarkCta title={b.closing} pills={b.keywords} />
    </>
  );
}
