import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconDownload } from "./icons";

export interface ExportOption {
  id: string;
  label: string;
  desc: string;
}

/** Export-Knopf mit kleinem Fenster: Format wählen, Hinweis lesen, exportieren */
export function ExportMenu({ options, note, onExport, disabled = false, title = "Exportieren", tone = "text-slate-600 hover:bg-slate-100 hover:text-slate-900" }: { options: ExportOption[]; note?: string; onExport: (format: string) => Promise<void> | void; disabled?: boolean; title?: string; /** Farbe des Symbols (z. B. Petrol wie die übrigen Artikel-Aktionen) */ tone?: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState(options[0].id);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onExport(format);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={title} title={title} className={`grid h-9 w-9 place-items-center rounded-lg disabled:opacity-40 ${tone}`}>
          <IconDownload size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] rounded-2xl border-slate-200 bg-white p-4 text-slate-900 shadow-pop">
        <p className="m-0 text-[16px] font-semibold">{title}</p>
        <div role="radiogroup" aria-label="Format" className="mt-3 flex flex-col">
          {options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={format === o.id} onClick={() => setFormat(o.id)} className="flex items-start gap-3 border-t border-slate-200 py-2.5 text-left first:border-t-0">
              <span aria-hidden="true" className={`mt-1 grid h-4 w-4 flex-none place-items-center rounded-full border ${format === o.id ? "border-teal-600" : "border-slate-300"}`}>
                {format === o.id && <span className="h-2 w-2 rounded-full bg-teal-600" />}
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{o.label}</span>
                <span className="block text-[12px] text-slate-500">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {note && <p className="m-0 mt-2 text-[12px] text-slate-500">{note}</p>}
        <button type="button" disabled={busy} onClick={run} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-900 text-[14px] font-medium text-white hover:opacity-85 disabled:opacity-50">
          {busy ? "Wird erstellt …" : "Exportieren →"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
