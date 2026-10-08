import type { CSSProperties } from "react";
import { useBrand } from "../lib/brand";
import { DarkCta, HitPreview, PageHead, SearchTermButton, useOpenSearch } from "./blocks";
import type { Branche } from "./content";
import { Icon } from "./icons";
import { AnalyticsLogo } from "../components/Brand";
import { ANALYSE_THUMBS } from "../pages/analytics/AnalyticsAbout";
import { useRouter } from "next/navigation";
import { ANALYSEN, ENTERPRISE, type EnterpriseBlock } from "./branchen-enterprise";

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

function EnterpriseSection({ e }: { e: EnterpriseBlock }) {
  const { name } = useBrand();
  const router = useRouter();
  const lead = e.layout === "lead" ? e.analysen[0] : null;
  const rest = e.layout === "lead" ? e.analysen.slice(1) : e.analysen;
  const card = (id: keyof typeof ANALYSEN, text: string, big = false) => {
    const a = ANALYSEN[id];
    const Thumb = ANALYSE_THUMBS[id];
    return (
      <button key={id} type="button" onClick={() => router.push(a.href)} className={"border-t border-slate-200 pt-5 text-left " + (big ? "lg:row-span-2 lg:pr-6" : "")}>
        <div className="mb-4"><Thumb /></div>
        <h3 className="m-0 text-[16px] font-semibold text-slate-900">{a.name}</h3>
        <p className="m-0 mt-2 text-[16px] leading-relaxed text-slate-500">{text}</p>
        <span className="mt-1 inline-block text-[14px] text-teal-600">Analyse öffnen →</span>
      </button>
    );
  };
  return (
    <section className="ri-sec bg-teal-50/40">
      <div className="mb-5"><AnalyticsLogo size={40} /></div>
      <h2 className="ri-h2">{e.title}</h2>
      <p className="ri-sub">Mit {name}.X und dem Tarif Enterprise, für Organisationen mit mehreren Beteiligten.</p>
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 24 }}>
        {lead && card(lead[0], lead[1], true)}
        {rest.map(([id, text]) => card(id, text))}
        <div className="border-t border-slate-200 pt-5">
          <Icon name="users" size={22} className="mb-3 text-teal-600" />
          <h3 className="m-0 text-[16px] font-semibold text-slate-900">{e.team[0]}</h3>
          <p className="m-0 mt-2 text-[16px] leading-relaxed text-slate-500">{e.team[1]}</p>
          <button type="button" onClick={() => router.push("/preise")} className="mt-1 text-[14px] text-teal-600 hover:underline">
            Tarife ansehen →
          </button>
        </div>
      </div>
    </section>
  );
}

export function BranchePage({ b }: { b: Branche }) {
  const { name } = useBrand();
  const term = b.keywords[0];
  const openBenefit = useOpenSearch();
  return (
    <>
      <PageHead icon={b.icon} label="Für Ihre Branche" name={b.name} title={b.title} lead={b.intro} aside={<HitPreview term={term} example={b.example} />}>
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

      {ENTERPRISE[b.slug] && <EnterpriseSection e={ENTERPRISE[b.slug]} />}

      <DarkCta title={b.closing} pills={b.keywords} />
    </>
  );
}
