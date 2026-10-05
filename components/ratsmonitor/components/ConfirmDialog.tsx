import { useEffect, useRef, useSyncExternalStore } from "react";

interface ConfirmOptions {
  title: string;
  text?: string;
  /** Beschriftung der Hauptaktion, z. B. „Löschen“ */
  confirmLabel?: string;
  cancelLabel?: string;
}
interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const listeners = new Set<() => void>();
let pending: Pending | null = null;
const emit = () => listeners.forEach((l) => l());

/** Eigene Rückfrage im Stil der Seite statt window.confirm; liefert true bei Bestätigung */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...options, resolve };
    emit();
  });
}
function settle(ok: boolean) {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
}

/** Einmal in der App eingebunden (neben GateDialog) */
export function ConfirmDialog() {
  const c = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
    () => null,
  );
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (c && !ref.current?.open) ref.current?.showModal();
    else if (!c && ref.current?.open) ref.current.close();
  }, [c]);
  return (
    <dialog
      ref={ref}
      /* Esc oder Klick daneben schließt das Fenster: gilt als Abbrechen */
      onClose={() => c && settle(false)}
      onClick={(e) => e.target === ref.current && settle(false)}
      aria-labelledby="confirm-title"
      className="w-[min(440px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-pop backdrop:bg-slate-900/40"
    >
      {c && (
        <>
          <h2 id="confirm-title" className="m-0 text-[22px] font-semibold">
            {c.title}
          </h2>
          {c.text && <p className="m-0 mt-2 text-[14px] leading-relaxed text-slate-600">{c.text}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" autoFocus onClick={() => settle(true)} className="btn-primary">
              {c.confirmLabel ?? "Bestätigen"}
            </button>
            <button type="button" onClick={() => settle(false)} className="btn-secondary">
              {c.cancelLabel ?? "Abbrechen"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
