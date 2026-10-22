import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

const KEY = "rm-rail-mini";
const apply = (mini: boolean) => document.documentElement.classList.toggle("rm-rail-mini", mini);

/**
 * Einklappen der Kachelleiste auf plenara.X (Themen, Kategorien, Bereiche, Werte): eingeklappt nur Symbole, der Name als Hinweis.
 * Standard ausgeklappt; die Wahl gilt für alle plenara.X-Seiten (Klasse rm-rail-mini an html, gemerkt im Browser).
 */
export function RailToggle() {
  const [mini, setMini] = useState(false);
  useEffect(() => {
    let v = false;
    try { v = localStorage.getItem(KEY) === "1"; } catch { /* ohne Speicher */ }
    apply(v);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gemerkter Wert erst im Browser lesbar
    setMini(v);
  }, []);
  const toggle = () => {
    const v = !mini;
    setMini(v);
    apply(v);
    try { if (v) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* ohne Speicher */ }
  };
  const I = mini ? ChevronsLeft : ChevronsRight;
  return (
    <button type="button" onClick={toggle} aria-pressed={mini} title={mini ? "Leiste ausklappen" : "Leiste einklappen"} aria-label={mini ? "Leiste ausklappen" : "Leiste einklappen"} className="rm-rail-toggle">
      <I size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{mini ? "" : "Einklappen"}</span>
    </button>
  );
}
