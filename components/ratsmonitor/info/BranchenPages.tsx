import Link from "next/link";
import type { CSSProperties } from "react";
import { useBrand } from "../lib/brand";
import { DarkCta, HitPreview, PageHead, SearchTermButton, useOpenSearch } from "./blocks";
import { BRANCHEN, type Branche } from "./content";
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

      {/* Nutzen und Themen im gleichen Dreier-Raster: Linie oben, Titel, Text */}
      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-h2">Ihr Nutzen</h2>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 24 }}>
          {b.benefits.map(([, title, text, term]) => (
            <div key={title} className="border-t border-slate-200 pt-5">
              <h3 className="m-0 text-[16px] font-semibold text-slate-900">{title}</h3>
              <div>
                <p className="m-0 mt-2 text-[16px] leading-relaxed text-slate-500">{text}</p>
                <button type="button" onClick={() => openBenefit(term)} className="mt-1 text-[14px] text-teal-600 hover:underline">
                  Suche „{term}“ →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ablauf als hell mintfarbenes Band: trennt die beiden Dreier-Raster */}
      <section className="ri-sec bg-teal-50/40">
        <h2 className="ri-h2">{b.flowTitle}</h2>
        <p className="ri-sub">{name} meldet bei jedem Schritt, zu dem die Kommune ein Dokument veröffentlicht.</p>
        <Timeline b={b} />
      </section>

      <section className="ri-sec ri-sec--tight">
        {/* Gleiche Überschrift wie die anderen Abschnitte; Themen als Zeile mit Häkchen, nicht auf die volle Breite gestreckt */}
        <h2 className="ri-h2">Worauf {name} für Sie achtet</h2>
        {/* Gleiches Raster wie „Ihr Nutzen“ */}
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 24 }}>
          {b.watch.map((w, i) => (
            <div key={w} className="border-t border-slate-200 pt-5">
              {b.watchIcons?.[i] && <Icon name={b.watchIcons[i]} size={22} className="mb-3 text-teal-600" />}
              <h3 className="m-0 text-[16px] font-semibold text-slate-900">{w}</h3>
              <p className="m-0 mt-2 text-[16px] leading-relaxed text-slate-500">{b.useCases?.[i] ?? ""}</p>
            </div>
          ))}
        </div>
      </section>

      <DarkCta title={b.closing} pills={b.keywords} />
    </>
  );
}
