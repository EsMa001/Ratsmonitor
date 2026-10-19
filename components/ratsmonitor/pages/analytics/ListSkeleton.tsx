/* Platzhalter für die Liste, solange eine neue Auswahl rechnet: pulsierende Kacheln statt des alten Ergebnisses */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-7 w-52 rounded-lg bg-slate-100" />
      <div className="mt-2 h-4 w-72 max-w-full rounded-md bg-slate-100" />
      <div className="mt-4 grid gap-3">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="h-[76px] rounded-xl bg-slate-100" />)}
      </div>
    </div>
  );
}
