import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBand } from "./PageBand";
import { XAtlasView } from "./XAtlasView";
import { THEMES, SUBTOPICS } from "@/shared/themes.mjs";
import { STAGES } from "@/shared/stage.mjs";

/** Themen des Atlas: „Alle Themen“ und die 10 Themen aus shared/themes.mjs (dieselben wie im Themenfilter der Suche) */
export const ATLAS_THEMEN: [string, string][] = [["", "Alle Themen"], ...THEMES.map((t: { id: string; name: string }) => [t.id, t.name] as [string, string])];
const THEME_IDS = new Set(THEMES.map((t: { id: string }) => t.id));
const SUB_IDS = new Map(SUBTOPICS.map((s: { id: string; theme: string }) => [s.id, s.theme]));
const STAGE_IDS = new Set(STAGES.map((s: { id: string }) => s.id));

export const atlasHref = ({ thema = "", sub = "", stage = "" }: { thema?: string; sub?: string; stage?: string }) => {
  const p = new URLSearchParams();
  if (thema) p.set("thema", thema);
  if (sub) p.set("sub", sub);
  if (stage) p.set("stage", stage);
  return `/analytics/atlas${p.size ? "?" + p : ""}`;
};

/**
 * plenara.X Atlas: eine Seite für alle Themen, auf der einen Abfrage /api/x (XAtlasView). Oben die Themenleiste, darunter
 * Unterthemen, was geschieht, Verlauf, Orte und jüngste Vorgänge.
 */
export function AtlasPage() {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const thema = THEME_IDS.has(params.get("thema") ?? "") ? params.get("thema")! : "";
  const subRaw = params.get("sub") ?? "";
  const sub = SUB_IDS.get(subRaw) === thema ? subRaw : "";
  const stageRaw = params.get("stage") ?? "";
  const stage = STAGE_IDS.has(stageRaw) ? stageRaw : "";
  const target = atlasHref({ thema, sub, stage });
  // Ungültige Auswahl: auf die gültige Atlas-Adresse umstellen (ohne neuen Verlaufseintrag)
  const current = path + (params.size ? "?" + params : "");
  useEffect(() => { if (current !== target) router.replace(target, { scroll: false }); }, [current, target, router]);
  const pick = (next: { thema?: string; sub?: string; stage?: string }) => router.replace(atlasHref(next), { scroll: false });
  const name = ATLAS_THEMEN.find(([id]) => id === thema)?.[1] ?? "";
  const stageName = STAGES.find((s: { id: string; name: string }) => s.id === stage)?.name;
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-700">plenara.X</Link> / Atlas</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">plenara.X Atlas</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Worüber die Räte beraten, nach den 10 Themen der Suche: Unterthemen, was geschieht, wo ein Thema viel Raum hat und die jüngsten Vorgänge. Thema wählen, mit Ort oder Begriff eingrenzen.</p>
      </PageBand>
      <nav aria-label="Thema des Atlas" className="-mx-[max(1vw,16px)] mt-2 overflow-x-auto px-[max(1vw,16px)] print:hidden">
        <ul className="m-0 flex w-max list-none gap-2 p-0">
          {ATLAS_THEMEN.map(([id, label]) => (
            <li key={id || "alle"}>
              <button type="button" aria-pressed={id === thema && !stage} onClick={() => pick({ thema: id })}
                className={`h-9 whitespace-nowrap rounded-full px-4 text-[14px] ${id === thema && !stage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{label}</button>
            </li>
          ))}
        </ul>
      </nav>
      <h2 className="mt-8 text-[22px] font-semibold">{[name, sub && SUBTOPICS.find((s: { id: string; name: string }) => s.id === sub)?.name, stageName].filter(Boolean).join(" · ")}</h2>
      {stage && <button type="button" onClick={() => pick({ thema, sub })} className="mt-1 text-[14px] font-medium text-teal-700 hover:underline">„{stageName}“ aufheben →</button>}
      <XAtlasView key={target} theme={thema} sub={sub} stage={stage} onTheme={(id) => pick({ thema: id })} onSub={(id) => pick({ thema, sub: id, stage })} />
    </main>
  );
}
