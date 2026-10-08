import type { CSSProperties } from "react";
import { useBrand } from "../lib/brand";
import { DarkCta, HitPreview, PageHead, SearchTermButton, useOpenSearch } from "./blocks";
import type { Branche } from "./content";
import { Icon } from "./icons";
import { AnalyticsLogo } from "../components/Brand";
import { LiveThumb } from "./BranchenLive";
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

function EnterpriseSection({ e, terms }: { e: EnterpriseBlock; terms: string[] }) {
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
    <section className="ri-sec bg-teal-50/40">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <AnalyticsLogo size={32} />
        <p className="m-0 text-[14px] text-slate-500">Im Tarif Enterprise, für Organisationen mit mehreren Beteiligten</p>
      </div>
      <h2 className="ri-h2" style={{ marginTop: 16 }}>{e.title}</h2>
      <div className="grid gap-10 sm:grid-cols-2" style={{ marginTop: 28 }}>
        {e.analysen.slice(0, 2).map(([id, text], i) => card(id, text, terms[i] ?? terms[0]))}
      </div>
      <p className="m-0 mt-10 max-w-[760px] border-t border-slate-200 pt-5 text-[16px] leading-relaxed text-slate-500">
        <strong className="font-semibold text-slate-900">{e.team[0]}: </strong>
        {e.team[1]}{" "}
        <button type="button" onClick={() => router.push("/preise")} className="text-teal-600 hover:underline">
          Tarife ansehen →
        </button>
      </p>
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

      {/* Ablauf */}
      <section className="ri-sec">
        <h2 className="ri-h2">{b.flowTitle}</h2>
        <p className="ri-sub">{name} meldet bei jedem Schritt, zu dem die Kommune ein Dokument veröffentlicht.</p>
        <Timeline b={b} />
      </section>

      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-h2">Worauf {name} für Sie achtet</h2>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 24 }}>
          {b.watch.map((w) => (
            <button key={w} type="button" onClick={() => openBenefit(w)} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[16px] text-slate-900 hover:border-teal-600 hover:text-teal-600">
              {w}
            </button>
          ))}
        </div>
      </section>

      {ENTERPRISE[b.slug] && <EnterpriseSection e={ENTERPRISE[b.slug]} terms={b.keywords} />}

      <DarkCta title={b.closing} pills={b.keywords} />
    </>
  );
}
