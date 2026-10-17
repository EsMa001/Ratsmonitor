import { useSyncExternalStore } from "react";
import { presetOf, RANGE_PRESETS, rangeLabel, resolveRange } from "../lib/savedSearch";
import { useSearch } from "../state/search";
import { FilterSelect } from "./FilterSelect";
import { IconCalendar } from "./icons";

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
  const preset = presetOf(von);
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
      const p = RANGE_PRESETS.find((x) => x.id === v);
      if (p) {
        setCustom(false);
        search.setZeitraum("@" + p.id, "");
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
          options={[...RANGE_PRESETS.map((p) => ({ value: p.id, label: p.id === "y0" || p.id === "y1" ? `${p.label} (${p.range()[0].slice(0, 4)})` : p.label })), { value: CUSTOM, label: value === CUSTOM && (von || bis) ? rangeLabel(...resolveRange(von, bis)) : "Zeitraum wählen …" }]}
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
  const { search, value, ...raw } = useZeitraum();
  if (value !== CUSTOM) return null;
  /* Nach einer Schnellauswahl zeigen die Felder deren Daten; geändert wird daraus ein fester Zeitraum */
  const [von, bis] = resolveRange(raw.von, raw.bis);
  /* Von nach Bis (oder umgekehrt) angleichen, damit der Zeitraum nie leer läuft */
  const setVon = (v: string) => search.setZeitraum(v, bis && v && v > bis ? v : bis);
  const setBis = (v: string) => search.setZeitraum(von && v && v < von ? v : von, v);
  const field =
    "h-8 min-w-0 flex-1 rounded-xl border border-white/80 bg-white/40 px-2 text-[14px] text-slate-900 outline-none focus:border-teal-600 max-sm:h-9 max-sm:border-[rgba(168,220,213,.9)] max-sm:bg-[rgba(196,229,224,.45)] max-sm:text-teal-700";
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
