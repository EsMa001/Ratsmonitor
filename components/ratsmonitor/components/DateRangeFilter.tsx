import { useSyncExternalStore } from "react";
import { rangeLabel } from "../lib/savedSearch";
import { useSearch } from "../state/search";
import { FilterSelect } from "./FilterSelect";
import { IconCalendar } from "./icons";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));

interface Preset {
  id: string;
  label: string;
  von: () => string;
  bis: () => string;
}
const YEAR = new Date().getFullYear();
const PRESETS: Preset[] = [
  { id: "d7", label: "Letzte 7 Tage", von: () => daysAgo(7), bis: () => daysAgo(0) },
  { id: "d30", label: "Letzte 30 Tage", von: () => daysAgo(30), bis: () => daysAgo(0) },
  { id: "d91", label: "Letzte 3 Monate", von: () => daysAgo(91), bis: () => daysAgo(0) },
  { id: "d365", label: "Letzte 12 Monate", von: () => daysAgo(365), bis: () => daysAgo(0) },
  { id: "y0", label: `Dieses Jahr (${YEAR})`, von: () => `${YEAR}-01-01`, bis: () => `${YEAR}-12-31` },
  { id: "y1", label: `Letztes Jahr (${YEAR - 1})`, von: () => `${YEAR - 1}-01-01`, bis: () => `${YEAR - 1}-12-31` },
];
const CUSTOM = "custom";

/* „Zeitraum wählen“ ist offen: gemeinsam gemerkt, weil Auswahlfeld (Kopfzeile) und Datumsfelder (darunter) getrennt sitzen können */
const listeners = new Set<() => void>();
let customOpen = false;
const setCustom = (v: boolean) => {
  customOpen = v;
  listeners.forEach((l) => l());
};
const useCustom = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => customOpen,
    () => false,
  );

function useZeitraum() {
  const search = useSearch();
  const { von, bis } = search.state;
  const custom = useCustom();
  const preset = PRESETS.find((p) => von === p.von() && bis === p.bis());
  /* „Zeitraum wählen“ hat Vorrang, auch wenn die Daten zufällig zu einer Schnellauswahl passen */
  const value = custom ? CUSTOM : preset ? preset.id : von || bis ? CUSTOM : "";
  return { search, von, bis, value };
}

/** Auswahlfeld: Schnellauswahl und „Zeitraum wählen“; mit Kalender-Symbol davor (Desktop) oder ohne (in der Kopfzeile des Filters auf dem Handy) */
export function DateRangeSelect({ withIcon = true }: { withIcon?: boolean }) {
  const { search, von, bis, value } = useZeitraum();
  const onChange = (v: string) => {
    if (v === "") {
      setCustom(false);
      search.setZeitraum("", "");
    } else if (v === CUSTOM) {
      setCustom(true);
    } else {
      const p = PRESETS.find((x) => x.id === v);
      if (p) {
        setCustom(false);
        search.setZeitraum(p.von(), p.bis());
      }
    }
  };
  return (
    <div className="flex items-center gap-2">
      {withIcon && <IconCalendar size={18} className="flex-none text-slate-500" />}
      <div className="min-w-0 flex-1">
        <FilterSelect
          id="f-zeitraum"
          label="Zeitraum"
          allLabel="Gesamter Zeitraum"
          value={value}
          options={[...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: CUSTOM, label: value === CUSTOM && (von || bis) ? rangeLabel(von, bis) : "Zeitraum wählen …" }]}
          onChange={onChange}
          /* Pfeil etwas weiter links, damit er nicht am Rand klebt */
          className="min-w-0 [&_button]:!w-full [&_button]:!min-w-0 [&_button]:!max-w-none [&_svg]:!right-5"
        />
      </div>
    </div>
  );
}

/** Von/Bis mit dem Datumswähler des Geräts, nur bei „Zeitraum wählen“ */
export function DateRangeFields() {
  const { search, von, bis, value } = useZeitraum();
  if (value !== CUSTOM) return null;
  /* Von nach Bis (oder umgekehrt) angleichen, damit der Zeitraum nie leer läuft */
  const setVon = (v: string) => search.setZeitraum(v, bis && v && v > bis ? v : bis);
  const setBis = (v: string) => search.setZeitraum(von && v && v < von ? v : von, v);
  const field =
    "h-8 min-w-0 flex-1 rounded-xl border border-white/80 bg-white/40 px-2 text-[14px] text-slate-900 outline-none focus:border-teal-600 max-sm:h-9 max-sm:border-[rgba(153,246,228,.9)] max-sm:bg-[rgba(204,251,241,.45)] max-sm:text-teal-700";
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" aria-label="Von" value={von} max={bis || undefined} onChange={(e) => setVon(e.target.value)} className={field} />
      <span aria-hidden="true" className="text-slate-500">–</span>
      <input type="date" aria-label="Bis" value={bis} min={von || undefined} onChange={(e) => setBis(e.target.value)} className={field} />
    </div>
  );
}

/** Zeitraum am Desktop: Auswahlfeld mit den Datumsfeldern darunter */
export function DateRangeFilter() {
  return (
    <div className="flex flex-col gap-1.5">
      <DateRangeSelect />
      <DateRangeFields />
    </div>
  );
}
