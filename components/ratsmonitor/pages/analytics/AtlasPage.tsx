import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { XKopf, XWeiter } from "./XKopf";
import { XAtlasView } from "./XAtlasView";
import { ThemeIcon } from "../../components/icons";
import { WheelPicker } from "../../components/WheelPicker";
import { THEMES, SUBTOPICS } from "@/shared/themes.mjs";

/** Themen des Atlas: „Alle Themen“ und die 10 Themen aus shared/themes.mjs (dieselben wie im Themenfilter der Suche) */
export const ATLAS_THEMEN: [string, string][] = [["", "Alle Themen"], ...THEMES.map((t: { id: string; name: string }) => [t.id, t.name] as [string, string])];
const THEME_IDS = new Set(THEMES.map((t: { id: string }) => t.id));
const SUB_IDS = new Map(SUBTOPICS.map((s: { id: string; theme: string }) => [s.id, s.theme]));

/* Ort aus der Adresse (useOrtInAdresse hält ?ort aktuell, auch ohne den Router) */
const ortNow = () => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ort") ?? "");
export const atlasHref = ({ thema = "", sub = "", zeit = "", ort = "" }: { thema?: string; sub?: string; zeit?: string; ort?: string }) => {
  const p = new URLSearchParams();
  if (thema) p.set("thema", thema);
  if (sub) p.set("sub", sub);
  if (zeit) p.set("zeit", zeit);
  if (ort) p.set("ort", ort);
  return `/analytics/atlas${p.size ? "?" + p : ""}`;
};

/**
 * plenara.X Atlas: eine Seite für alle Themen, auf der einen Abfrage /api/x (XAtlasView). Oben die Themenleiste, darunter
 * Unterthemen, Verlauf, Orte und jüngste Vorgänge.
 */
export function AtlasPage() {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const thema = THEME_IDS.has(params.get("thema") ?? "") ? params.get("thema")! : "";
  const subRaw = params.get("sub") ?? "";
  const sub = SUB_IDS.get(subRaw) === thema ? subRaw : "";
  /* Zeitraum wie in den Signalen (3, 6, 12 Monate); ohne Angabe der ganze Bestand */
  const zeit = ["3", "6", "12"].includes(params.get("zeit") ?? "") ? params.get("zeit")! : "";
  const ort = /^\d{5,9}$/.test(params.get("ort") ?? "") ? params.get("ort")! : "";
  const target = atlasHref({ thema, sub, zeit, ort });
  /* Suchbegriff aus einem geteilten Link (?q=, von „Link kopieren“): einmal beim Öffnen, XAtlasView übernimmt ihn in die Suche */
  const [term] = useState(() => params.get("q")?.trim() || null);
  // Ungültige Auswahl und ?q=: auf die gültige Atlas-Adresse umstellen (ohne neuen Verlaufseintrag)
  const current = path + (params.size ? "?" + params : "");
  useEffect(() => { if (current !== target) router.replace(target, { scroll: false }); }, [current, target, router]);
  /* Eine Wahl ist ein Schritt im Verlauf: Zurück führt zur vorigen Auswahl */
  const pick = (next: { thema?: string; sub?: string; zeit?: string }) => router.push(atlasHref({ zeit, ort: ortNow(), ...next }), { scroll: false });
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="atlas" />
      {/* Handy: Auswahlfeld; Tablet 6 Kacheln je Reihe; Desktop alle in einer Reihe (nie waagerecht scrollen) */}
      <WheelPicker label="Thema" className="mt-2" value={thema} onPick={(id) => pick(id ? { thema: id } : {})}
        items={ATLAS_THEMEN.map(([id, label]) => ({ id, label, icon: <ThemeIcon theme={id || "alle"} size={18} className="text-slate-500" />, iconOn: <ThemeIcon theme={id || "alle"} size={18} className="text-white" /> }))} />
      <nav aria-label="Thema" className="mt-2 hidden sm:block print:hidden">
        <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 lg:grid-cols-11">
          {ATLAS_THEMEN.map(([id, label]) => (
            <li key={id || "alle"}>
              {/* Kacheln ohne Rahmen: Icon über dem Namen, nur das gewählte Thema mit heller Fläche (Linien statt Kästen) */}
              <button type="button" aria-pressed={id === thema} onClick={() => pick(id ? { thema: id } : {})}
                className={`flex h-full min-h-[68px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[12px] leading-tight ${id === thema ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                <ThemeIcon theme={id || "alle"} size={24} className={id === thema ? "text-teal-700" : "text-slate-500"} />
                <span>{label}</span></button>
            </li>
          ))}
        </ul>
      </nav>
      <XAtlasView theme={thema} sub={sub} zeit={zeit} term={term} onTheme={(id) => pick({ thema: id })} onSub={(id) => pick({ thema, sub: id })} onZeit={(z) => pick({ thema, sub, zeit: z })} />
    <XWeiter links={[["/analytics/trends", "Was verändert sich? (Trends)"], ["/analytics/vergleich", "Mit anderem Ort vergleichen"], ["/analytics/gremien", "Wo wird das beraten? (Gremien)"], ["/analytics/signale", "Was entsteht? (Projekte)"]]} />
    </main>
  );
}
