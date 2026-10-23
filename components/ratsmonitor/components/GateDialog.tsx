import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { IS_DEV, setTier, getTier, TIER_LABEL, UPGRADE_TEXT, type Tier } from "../lib/tier";
import { getMe, useMe } from "../lib/account";

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

/** Öffnet den Hinweis „Anmelden“ (ohne Konto) bzw. „Stufe“ (mit Konto) */
export function openGate(g: Gate) {
  gate = g;
  emit();
}
/** Hinweis zu einer Grenze, die der Server meldet (409 {limit}, 403 {limit:'results'}) */
export function openLimitGate(limit: unknown, total?: number) {
  const feature: GateFeature | null = limit === "bookmarks" ? "bookmarks" : limit === "savedSearches" ? "searches" : limit === "notifications" ? "notifications" : limit === "results" ? "results" : limit === "filters" ? "filters" : null;
  if (!feature) return false;
  const tier = getTier();
  openGate({ feature, needs: !getMe().user || tier === "guest" ? "basic" : "pro", total });
  return true;
}
function closeGate() {
  gate = null;
  emit();
}

/* login: ohne Konto; upgrade: Konto mit Stufe, die nicht reicht */
const FEATURE: Record<GateFeature, { title: string; login: string; upgrade: string }> = {
  results: {
    title: "Alle Treffer sehen",
    login: "Ohne Anmeldung sehen Sie die ersten 10 Treffer je Suche, mit einem kostenlosen Konto 20. Mit Plus sehen Sie alle Treffer.",
    upgrade: "Mit dem kostenlosen Konto sehen Sie 20 Treffer je Suche. Mit Plus sehen Sie alle Treffer.",
  },
  filters: {
    title: "Filter nutzen",
    login: "Filter nach Gebiet, Thema, Zeitraum und Status stehen allen zur Verfügung.",
    upgrade: "",
  },
  bookmarks: {
    title: "Artikel speichern",
    login: "Melden Sie sich an, um Artikel zu speichern und später wiederzufinden.",
    upgrade: "Mit dem kostenlosen Konto können Sie 5 Artikel speichern. Mit Plus speichern Sie bis zu 100 Artikel.",
  },
  searches: {
    title: "Suchen speichern",
    login: "Melden Sie sich an, um Suchen zu speichern und neue Treffer im Blick zu behalten.",
    upgrade: "Mit dem kostenlosen Konto können Sie 5 Suchen speichern. Mit Plus speichern Sie bis zu 100 Suchen.",
  },
  notifications: {
    title: "Benachrichtigungen",
    login: "Melden Sie sich an, um per E-Mail von neuen Treffern und Neuigkeiten zu Vorgängen zu erfahren.",
    upgrade: "Mit dem kostenlosen Konto sind 5 Benachrichtigungen gleichzeitig aktiv. Mit Plus sind es bis zu 100.",
  },
  emails: {
    title: "Mehrere Empfänger",
    login: "Melden Sie sich an, um Benachrichtigungen per E-Mail zu erhalten.",
    upgrade: "Weitere Empfänger für Benachrichtigungen gibt es noch nicht.",
  },
};
const NO_TIER = "Ihr Konto ist noch für keine Stufe freigeschaltet.";

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
  const me = useMe();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (g && !ref.current?.open) ref.current?.showModal();
    else if (!g && ref.current?.open) ref.current.close();
  }, [g]);

  const f = g ? FEATURE[g.feature] : null;
  /* Ohne Konto: Anmelden. Mit Konto: Stufe nennen, Freischaltung in der Testphase auf Anfrage */
  const login = !me.user && me.accounts;
  const text = f && g ? (login ? f.login : me.tier === "guest" ? `${NO_TIER} ${f.upgrade}`.trim() : f.upgrade || NO_TIER) : "";
  const here = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;

  return (
    <dialog
      ref={ref}
      onClose={closeGate}
      aria-labelledby="gate-title"
      aria-describedby="gate-text"
      className="w-[min(440px,calc(100vw-32px))] rm-dialog rounded-[24px] p-6 text-slate-900"
    >
      {g && f && (
        <>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${login ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-700"}`}>
            {login ? "Konto" : TIER_LABEL[g.needs]}
          </span>
          <h2 id="gate-title" className="mb-2 mt-3 text-[22px] font-semibold">
            {f.title}
          </h2>
          <p id="gate-text" className="m-0 text-[14px] leading-relaxed text-slate-600">
            {text}
            {g.feature === "results" && g.total ? ` Insgesamt gibt es ${g.total.toLocaleString("de-DE")} Treffer.` : ""}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {login ? (
              <Link href={`/anmelden?weiter=${encodeURIComponent(here)}`} onClick={closeGate} className="btn-primary">
                Anmelden
              </Link>
            ) : (
              <Link href="/kontakt" onClick={closeGate} className="btn-primary">
                {UPGRADE_TEXT}
              </Link>
            )}
            <button type="button" onClick={closeGate} className="btn-secondary">
              Später
            </button>
            {IS_DEV && (
              <button
                type="button"
                onClick={() => {
                  setTier("pro");
                  closeGate();
                }}
                className="ml-auto text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                Dev: als Plus fortfahren
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
