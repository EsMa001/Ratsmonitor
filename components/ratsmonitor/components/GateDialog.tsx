import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { countLabel, IS_DEV, LIMITS, nextTier, setTier, getTier, TIER_LABEL, UPGRADE_TEXT, type Tier } from "../lib/tier";
import { getMe, useMe } from "../lib/account";
import { type Bookable } from "../lib/booking";
import { AboModels } from "./AboModels";

/** Funktionen, die je nach Stufe gesperrt oder begrenzt sind */
export type GateFeature = "results" | "filters" | "bookmarks" | "searches" | "notifications" | "emails" | "calendarAreas" | "freq" | "weeklyReport";

/** Stufe, die eine Funktion freischaltet: ohne Konto das Konto, sonst die nächste Stufe (Plus, dann Pro) */
export function needsFor(feature: GateFeature, tier: Tier): Tier {
  if (tier === "guest") return "basic";
  if (feature === "emails") return "enterprise";
  if (feature === "freq") return "pro";
  if (feature === "results" || feature === "weeklyReport") return tier === "basic" ? "plus" : "pro";
  return nextTier(tier);
}

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
  const feature: GateFeature | null =
    limit === "bookmarks" ? "bookmarks" : limit === "savedSearches" ? "searches" : limit === "notifications" ? "notifications" : limit === "results" ? "results"
    : limit === "filters" ? "filters" : limit === "calendarAreas" ? "calendarAreas" : limit === "freq" ? "freq" : limit === "weeklyReport" ? "weeklyReport" : null;
  if (!feature) return false;
  openGate({ feature, needs: needsFor(feature, getMe().user ? getTier() : "guest"), total });
  return true;
}
function closeGate() {
  gate = null;
  emit();
}

/* Zahlen aus shared/plans.mjs (lib/tier.ts); „Mit Plus …, mit Pro …“ je nach eigener Stufe */
const { basic: B, plus: P } = LIMITS;
const more = (tier: Tier, plus: string, pro: string) => (tier === "plus" ? `Mit Pro ${pro}.` : `Mit Plus ${plus}, mit Pro ${pro}.`);
/* login: ohne Konto; upgrade: Konto mit Stufe, die nicht reicht */
const FEATURE: Record<GateFeature, { title: string; login: string; upgrade: (tier: Tier) => string }> = {
  results: {
    title: "Alle Treffer sehen",
    login: `Ohne Anmeldung sehen Sie die ersten ${LIMITS.guest.maxResults} Treffer je Suche, mit einem kostenlosen Konto ${B.maxResults}. Mit Plus sehen Sie alle Treffer.`,
    upgrade: () => `Mit dem kostenlosen Konto sehen Sie ${B.maxResults} Treffer je Suche. Mit Plus sehen Sie alle Treffer.`,
  },
  filters: {
    title: "Filter nutzen",
    login: "Ohne Anmeldung suchen Sie mit Begriff und Ort. Mit einem kostenlosen Konto filtern Sie zusätzlich nach Zeitraum, Thema und Status.",
    upgrade: () => "",
  },
  bookmarks: {
    title: "Artikel speichern",
    login: "Melden Sie sich an, um Artikel zu speichern und später wiederzufinden.",
    upgrade: (t) => `${t === "plus" ? `Mit Plus speichern Sie ${P.bookmarks} Artikel.` : `Mit dem kostenlosen Konto speichern Sie ${B.bookmarks} Artikel.`} ${more(t, `${P.bookmarks}`, "unbegrenzt viele")}`,
  },
  searches: {
    title: "Suchen speichern",
    login: "Melden Sie sich an, um Suchen zu speichern und neue Treffer im Blick zu behalten.",
    upgrade: (t) => `${t === "plus" ? `Mit Plus speichern Sie ${P.savedSearches} Suchen.` : `Mit dem kostenlosen Konto speichern Sie ${B.savedSearches} Suche.`} ${more(t, `${P.savedSearches}`, "unbegrenzt viele")}`,
  },
  notifications: {
    title: "Benachrichtigungen",
    login: "Melden Sie sich an, um per E-Mail von neuen Treffern und Neuigkeiten zu Vorgängen zu erfahren.",
    upgrade: (t) =>
      t === "plus"
        ? "Mit Plus kommen alle Suchen und gefolgten Vorgänge in einem Wochenbericht. Mit Pro stellen Sie jede Suche einzeln ein, bis täglich, ohne Grenze."
        : `Mit dem kostenlosen Konto ist ${B.notifications === 1 ? "eine Benachrichtigung" : `${B.notifications} Benachrichtigungen`} aktiv, wöchentlich. Mit Plus kommt jede Woche ein Bericht zu allen Suchen und gefolgten Vorgängen, mit Pro je Suche bis täglich.`,
  },
  emails: {
    title: "Mehrere Empfänger",
    login: "Melden Sie sich an, um Benachrichtigungen per E-Mail zu erhalten.",
    upgrade: () => "Weitere Empfänger für Benachrichtigungen gibt es noch nicht.",
  },
  calendarAreas: {
    title: "Gebiete im Kalender",
    login: "Melden Sie sich an, um die Sitzungstermine Ihres Ortes im Kalender zu sehen.",
    upgrade: (t) => `${t === "plus" ? `Mit Plus zeigt der Kalender ${P.calendarAreas} Gebiete.` : `Mit dem kostenlosen Konto zeigt der Kalender ${countLabel(B.calendarAreas) === "1" ? "ein Gebiet" : `${B.calendarAreas} Gebiete`}.`} ${more(t, `${P.calendarAreas} Gebiete`, "unbegrenzt viele")}`,
  },
  freq: {
    title: "Täglich benachrichtigt",
    login: "Melden Sie sich an, um per E-Mail von neuen Treffern zu erfahren.",
    upgrade: () => "Tägliche Mails gibt es mit Pro, für jede Suche einzeln einstellbar. Konto und Plus bekommen ihre Mails einmal in der Woche.",
  },
  weeklyReport: {
    title: "Wochenbericht",
    login: "Melden Sie sich an, um neue Treffer Ihrer Suchen per E-Mail zu bekommen.",
    upgrade: () => "Der Wochenbericht zu allen gespeicherten Suchen gehört zu Plus: eine Mail je Woche, am Tag Ihrer Wahl.",
  },
};
const NO_TIER = "Ihr Konto ist noch für keine Stufe freigeschaltet.";
/** Abo-Modelle, die eine Grenze heben (AboModels unter dem Text): braucht es Pro, nur Pro; weitere Empfänger gibt es noch nicht */
const modelsFor = (g: Gate): Bookable[] => (g.feature === "emails" ? [] : g.needs === "pro" ? ["pro"] : ["plus", "pro"]);

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
  /* Ohne Konto: Anmelden. Mit Konto: Stufe nennen; Plus führt zur Buchung (lib/booking.ts), sonst zur Anfrage */
  const login = !me.user && me.accounts;
  const upgrade = f ? f.upgrade(me.tier) : "";
  const text = f && g ? (login ? f.login : me.tier === "guest" ? `${NO_TIER} ${upgrade}`.trim() : upgrade || NO_TIER) : "";
  const models = g ? modelsFor(g) : [];
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
          {/* An jeder Grenze derselbe Hinweis auf die Abo-Modelle */}
          {models.length > 0 && <AboModels only={models} onPick={closeGate} className="mt-4 border-t border-slate-200 pt-4" />}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {login ? (
              <Link href={`/anmelden?weiter=${encodeURIComponent(here)}`} onClick={closeGate} className="btn-primary">
                Kostenlos anmelden
              </Link>
            ) : (
              !models.length && (
                <Link href="/kontakt" onClick={closeGate} className="btn-primary">
                  {UPGRADE_TEXT}
                </Link>
              )
            )}
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
                Dev: als {TIER_LABEL[g.needs]} fortfahren
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
