import { IconChevronDown } from "./icons";

interface Option {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  allLabel: string;
  value: string;
  options: Option[];
  counts?: Record<string, number>;
  onChange: (v: string) => void;
  size?: "md" | "sm";
  className?: string;
  /** aktive Auswahl farbig hervorheben (für Filter ja, für die Sortierung nein) */
  highlight?: boolean;
}

/** Auswahlliste im Stil der Kopfzeile; aktive Auswahl in Teal, Zähler in Klammern */
export function FilterSelect({ id, label, allLabel, value, options, counts, onChange, size = "md", className = "", highlight = true }: Props) {
  const sm = size === "sm";
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`select-base w-full text-ellipsis ${sm ? "!h-9 !rounded-lg !pl-3 !pr-8 !text-[13px]" : "desk:w-auto desk:min-w-[150px] desk:max-w-[200px]"} ${
          value && highlight ? "select-active" : ""
        }`}
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {counts ? ` (${counts[o.value] || 0})` : ""}
          </option>
        ))}
      </select>
      <IconChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
    </div>
  );
}
