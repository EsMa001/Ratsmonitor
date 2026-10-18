import { useState, type ReactNode } from "react";
import { Banknote, ChevronsUpDown, CircleDot, FileText, Gavel, Handshake, Hammer, Landmark, LayoutGrid, MessageSquare, PencilRuler, ScrollText, Users } from "lucide-react";
import { Sheet } from "../menu/Sheet";
import { PickTile } from "../menu/SegTiles";

export interface PickItem { id: string; label: string; count?: string; dot?: string }

/* Symbol zum Namen des Schritts: nach Stichwort, sonst der farbige Punkt des Schritts */
function iconOf(item: PickItem): ReactNode {
  const l = item.label.toLowerCase(), c = { size: 18, strokeWidth: 1.5, "aria-hidden": true as const };
  if (!item.id) return <LayoutGrid {...c} />;
  if (/planung|konzept|aufstellung/.test(l)) return <PencilRuler {...c} />;
  if (/bau|sanier/.test(l)) return <Hammer {...c} />;
  if (/ausschreib|vergabe|zuschlag/.test(l)) return <Gavel {...c} />;
  if (/bericht|sachstand/.test(l)) return <FileText {...c} />;
  if (/antrag|anfrage/.test(l)) return <MessageSquare {...c} />;
  if (/grundst/.test(l)) return <Landmark {...c} />;
  if (/förder|zuschuss|gebühr|beitr|steuer|haushalt/.test(l)) return <Banknote {...c} />;
  if (/vertrag|vereinbar/.test(l)) return <Handshake {...c} />;
  if (/satzung|regelung|beschluss/.test(l)) return <ScrollText {...c} />;
  if (/beteilig|offenlage/.test(l)) return <Users {...c} />;
  return item.dot ? <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${item.dot}`} /> : <CircleDot {...c} />;
}

/** Handy: eine Zeile mit der gewählten Stufe; ein Tipp öffnet ein Blatt mit Kacheln (Symbol, Name, Zahl). Ab 640 px entfällt sie. */
export function PhasePicker({ label, items, value, onPick }: { label: string; items: PickItem[]; value: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = items.find((i) => i.id === value) ?? items[0];
  return (
    <div className="sm:hidden print:hidden">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-teal-600/30 bg-teal-50 px-3 text-left text-[14px] font-semibold text-teal-800">
        <span className="shrink-0">{iconOf(cur)}</span>
        <span className="min-w-0 flex-1 truncate"><span className="font-normal text-slate-600">{label}: </span>{cur.label}{cur.count ? ` (${cur.count})` : ""}</span>
        <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={label}>
        <p className="m-0 text-[16px] font-semibold">{label}</p>
        <ul className="m-0 mt-3 grid max-h-[62vh] list-none grid-cols-2 gap-2 overflow-y-auto p-0">
          {items.map((i) => (
            <li key={i.id || "alle"}><PickTile icon={iconOf(i)} label={i.label} count={i.count} on={i.id === value} onClick={() => { onPick(i.id); setOpen(false); }} /></li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
