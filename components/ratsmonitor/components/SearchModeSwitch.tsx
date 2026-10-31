import { useRouter, useSearchParams } from "next/navigation";
import { useMe } from "../lib/account";
import { useSearchResults } from "../state/search";
import { docsHref } from "../pages/dokumente/useDocSearch";
import { openGate } from "./GateDialog";

/** Umschalter „Vorgänge | Dokumente“ über der Trefferliste der Suche und im Kopf der Dokumentsuche. Nimmt Begriff und Ort mit.
 *  Ohne Pro öffnet „Dokumente“ den Hinweis (die Seite /dokumente selbst ist für alle aufrufbar, mit Beispiel). */
export function SearchModeSwitch({ mode, className = "" }: { mode: "vorgaenge" | "dokumente"; className?: string }) {
  const router = useRouter();
  const me = useMe();
  const res = useSearchResults();
  const params = useSearchParams();
  const toDocs = () => {
    if (me.ready && !me.features.fulltext) return openGate({ feature: "fulltext", needs: "pro" });
    /* Alternativen der Suche (Komma) werden zu „oder“ der Dokumentsuche */
    router.push(docsHref({ q: res.snapshot.text.replace(/\s*[,;|]\s*/g, " oder ").trim(), ort: res.snapshot.area }));
  };
  const toSearch = () => {
    const p = new URLSearchParams(), q = params.get("q") ?? "", ort = params.get("ort") ?? "";
    if (q) p.set("q", q);
    if (ort) p.set("ort", ort);
    if (ort.length === 5) p.set("umfang", "mit");
    router.push(`/suche${p.size ? `?${p}` : ""}`);
  };
  const item = (on: boolean) =>
    `relative inline-flex h-8 items-center rounded-full px-3 text-[14px] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] ${on ? "bg-white font-semibold text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;
  return (
    <div role="group" aria-label="Suchen in" className={`inline-flex shrink-0 rounded-full bg-slate-100 p-0.5 ${className}`}>
      <button type="button" aria-pressed={mode === "vorgaenge"} onClick={mode === "vorgaenge" ? undefined : toSearch} className={item(mode === "vorgaenge")}>Vorgänge</button>
      <button type="button" aria-pressed={mode === "dokumente"} onClick={mode === "dokumente" ? undefined : toDocs} className={item(mode === "dokumente")}>Dokumente</button>
    </div>
  );
}
