/** Platzhalter, solange eine Auswertung berechnet wird: zeigt schon die Form der Seite statt nur eines Satzes */
export function Laden({ text }: { text: string }) {
  return (
    <div className="mt-8" role="status" aria-live="polite">
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-7 w-[min(640px,90%)] rounded-full bg-slate-100" />
        <div className="mt-3 h-7 w-[min(420px,70%)] rounded-full bg-slate-100" />
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100" />)}</div>
        <div className="mt-10 h-48 rounded-[20px] bg-slate-100" />
      </div>
      <p className="mt-4 text-[14px] text-slate-500">{text} Das kann einige Sekunden dauern.</p>
    </div>
  );
}
