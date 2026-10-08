import { useState, type CSSProperties } from "react";
import { useBrand } from "../lib/brand";
import { HitPreview, PageHead, SearchTermButton, useOpenSearch } from "./blocks";
import type { Branche } from "./content";
import { Icon } from "./icons";
import { AnalyticsLogo } from "../components/Brand";
import { LiveThumb } from "./BranchenLive";
import { useRouter } from "next/navigation";
import { ANALYSEN, ENTERPRISE, PLENARAX_VORTEILE, type EnterpriseBlock } from "./branchen-enterprise";

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
            {!reported && <span className="ri-tl__label">Außerhalb des Rats</span>}
            <span className="ri-tl__title">{title}</span>
          </li>
        );
      })}
    </ol>
  );
}

function EnterpriseSection({ e, terms, slug }: { e: EnterpriseBlock; terms: string[]; slug: string }) {
  const { name } = useBrand();
  const router = useRouter();
  const card = (id: keyof typeof ANALYSEN, text: string, term: string) => {
    const a = ANALYSEN[id];
    return (
      <button key={id} type="button" onClick={() => router.push(a.href)} className="text-left">
        <LiveThumb id={id} term={term} />
        <h3 className="m-0 mt-4 text-[16px] font-semibold text-slate-900">{a.name}</h3>
        <p className="m-0 mt-2 text-[16px] leading-relaxed text-slate-500">{text}</p>
      </button>
    );
  };
  return (
    <section className="ri-sec" style={{ backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0) 40%, #ffffff 100%), radial-gradient(circle, rgba(13,148,136,0.22) 1.3px, transparent 1.8px)", backgroundSize: "100% 100%, 22px 22px" }}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2" style={{ marginTop: -40 }}>
        <AnalyticsLogo size={32} />
        <p className="m-0 text-[14px] text-slate-500">Im Tarif Enterprise</p>
      </div>
      
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3" style={{ marginTop: 24 }}>
        {PLENARAX_VORTEILE.map(([id, title, text]) => (
          <button key={title} type="button" onClick={() => router.push(ANALYSEN[id].href)} className="flex w-full flex-col justify-start text-left">
            <h3 className="m-0 text-[16px] font-semibold text-slate-900">{title}</h3>
            <div className="mt-3"><LiveThumb id={id} term={terms[0]} /></div>
            <p className="m-0 mt-4 text-[16px] leading-relaxed text-slate-500">{text}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function BranchePage({ b }: { b: Branche }) {
  const { name } = useBrand();
  const term = b.keywords[0];
  const openBenefit = useOpenSearch();
  const [pick, setPick] = useState(0);
  const beispiele = b.examples ?? [];
  return (
    <>
      <PageHead icon={b.icon} label="Anwender" name={b.name} title={b.title} lead={b.intro} aside={<HitPreview term={term} example={beispiele[pick] ?? b.example} topics={b.watch} active={pick} onPick={setPick} />}>
        <div className="ri-actions">
          <SearchTermButton term={term} />
        </div>
      </PageHead>

      {/* Nutzen je Rolle: Icon und Name der Rolle, darunter ihr konkreter Nutzen */}
      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-h2">Für Ihre Rolle</h2>
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 24 }}>
          {(b.rollen ?? []).map((rolle) => (
            <div key={rolle.name}>
              <div className="flex items-center gap-3">
                <span className="ri-tl__icon">
                  <Icon name={rolle.icon} size={18} />
                </span>
                <h3 className="m-0 text-[18px] font-semibold text-slate-900">{rolle.name}</h3>
              </div>
              <div className="mt-5 space-y-6 border-l-2 border-teal-100 pl-5">
                {b.benefits
                  .filter(([, , , , r]) => r === rolle.name)
                  .map(([, title, text, term]) => (
                    <div key={title}>
                      <p className="m-0 text-[16px] font-semibold text-slate-900">{title}</p>
                      <p className="m-0 mt-1 text-[16px] leading-relaxed text-slate-500">{text}</p>
                      <button type="button" onClick={() => openBenefit(term)} className="-mb-1.5 mt-0 py-1.5 text-[14px] text-teal-600 hover:underline">
                        Suche „{term}“ →
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ablauf */}
      <section className="ri-sec">
        <h2 className="ri-h2">{b.flowTitle}</h2>
        <p className="ri-sub">{name} meldet bei jedem Schritt, zu dem die Kommune ein Dokument veröffentlicht.</p>
        <Timeline b={b} />
      </section>

      {ENTERPRISE[b.slug] && <EnterpriseSection e={ENTERPRISE[b.slug]} terms={b.keywords} slug={b.slug} />}

    </>
  );
}
