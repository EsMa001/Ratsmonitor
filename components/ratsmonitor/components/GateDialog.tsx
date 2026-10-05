import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { IS_DEV, PRO_PRICE, setTier, type Tier } from "../lib/tier";

/** Funktionen, die je nach Stufe gesperrt oder begrenzt sind */
export type GateFeature = "results" | "filters" | "bookmarks" | "searches" | "notifications" | "emails";

interface Gate {
  feature: GateFeature;
  /** Stufe, die die Funktion freischaltet */
  needs: Tier;
  /** z. B. Gesamttrefferzahl für „Alle Treffer sehen“ */
  total?: number;
}

const listeners = new Set<() => void>();
let gate: Gate | null = null;
const emit = () => listeners.forEach((l) => l());

/** Öffnet den Hinweis „Registrieren“ (needs = basic) bzw. „Upgrade“ (needs = pro/enterprise) */
export function openGate(g: Gate) {
  gate = g;
  emit();
}
function closeGate() {
  gate = null;
  emit();
}

const FEATURE: Record<GateFeature, { title: string; login: string; upgrade: string }> = {
  results: {
    title: "Alle Treffer sehen",
    login: "Ohne Konto sehen Sie die ersten 10 Treffer je Suche. Mit einem kostenlosen Konto durchsuchen Sie alle Treffer deutschlandweit.",
    upgrade: "",
  },
  filters: {
    title: "Filter nutzen",
    login: "Filter nach Gebiet, Thema, Zeitraum und Status stehen mit einem kostenlosen Konto zur Verfügung.",
    upgrade: "",
  },
  bookmarks: {
    title: "Artikel speichern",
    login: "Melden Sie sich kostenlos an, um Artikel zu speichern und später wiederzufinden.",
    upgrade: "Mit Basic können Sie 1 Artikel speichern. Mit Pro speichern Sie unbegrenzt viele Artikel.",
  },
  searches: {
    title: "Suchen speichern",
    login: "Melden Sie sich kostenlos an, um Suchen zu speichern und neue Treffer im Blick zu behalten.",
    upgrade: "Mit Basic können Sie 1 Suche speichern. Mit Pro speichern Sie unbegrenzt viele Suchen.",
  },
  notifications: {
    title: "Benachrichtigungen",
    login: "Melden Sie sich kostenlos an, um bei Neuigkeiten benachrichtigt zu werden.",
    upgrade: "Mit Basic ist 1 Benachrichtigung gleichzeitig aktiv. Mit Pro erhalten Sie unbegrenzt viele Benachrichtigungen.",
  },
  emails: {
    title: "Mehrere Empfänger",
    login: "Melden Sie sich an, um Benachrichtigungen per E-Mail zu erhalten.",
    upgrade: "Mit Enterprise alarmieren Sie bis zu 5 E-Mail-Adressen oder Verteiler parallel, ideal für Teams.",
  },
};

/** Gemeinsamer Hinweis-Dialog für gesperrte Funktionen; einmal in der App eingebunden */
export function GateDialog() {
  const g = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => gate,
    () => null,
  );
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (g && !ref.current?.open) ref.current?.showModal();
    else if (!g && ref.current?.open) ref.current.close();
  }, [g]);

  const f = g ? FEATURE[g.feature] : null;
  const login = g?.needs === "basic";
  const text = f ? (login ? f.login : f.upgrade) : "";

  return (
    <dialog
      ref={ref}
      onClose={closeGate}
      aria-labelledby="gate-title"
      className="w-[min(440px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-pop backdrop:bg-slate-900/40"
    >
      {g && f && (
        <>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${login ? "bg-teal-50 text-teal-700" : "bg-amber-100 text-amber-800"}`}>
            {login ? "Kostenloses Konto" : g.needs === "enterprise" ? "Enterprise" : `Pro · ${PRO_PRICE}`}
          </span>
          <h2 id="gate-title" className="mb-2 mt-3 text-[22px] font-semibold">
            {f.title}
          </h2>
          <p className="m-0 text-[14px] leading-relaxed text-slate-600">
            {text}
            {g.feature === "results" && g.total ? ` Insgesamt gibt es ${g.total.toLocaleString("de-DE")} Treffer.` : ""}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="/konto/profil#tarif" onClick={closeGate} className="btn-primary">
              {login ? "Kostenlos registrieren" : g.needs === "enterprise" ? "Enterprise anfragen" : "Auf Pro upgraden"}
            </Link>
            <button type="button" onClick={closeGate} className="btn-secondary">
              Später
            </button>
            {IS_DEV && (
              <button
                type="button"
                onClick={() => {
                  setTier(g.needs);
                  closeGate();
                }}
                className="ml-auto text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                Dev: als {g.needs === "basic" ? "Basic" : g.needs === "pro" ? "Pro" : "Enterprise"} fortfahren
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
