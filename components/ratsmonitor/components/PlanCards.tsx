import { Segmented } from "./Segmented";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IS_DEV, PLAN_MAX, priceLabel, setTier, TIER_LABEL, UPGRADE_TEXT, useTier, type Tier } from "../lib/tier";
import { AccountApiError, api, reloadMe, shortDate, useMe } from "../lib/account";
import { usePlusLink } from "../lib/booking";
import { useClient } from "../lib/useClient";

/* Leistungen je Tarif: Text, wenn enthalten (je Stufe auch abweichend), sonst null = nicht aufgeführt (steht in der Vergleichstabelle) */
const FEATURES: { label: string; tiers: Record<Tier, string | null> }[] = [
  { label: "Ganz Deutschland", tiers: { guest: "Ganz Deutschland: alle Gebiete mit Daten", basic: "Ganz Deutschland: alle Gebiete mit Daten", pro: "Ganz Deutschland: alle Gebiete mit Daten", enterprise: "Ganz Deutschland: alle Gebiete mit Daten" } },
  { label: "Suche mit allen Filtern", tiers: { guest: "Suche mit allen Filtern", basic: "Suche mit allen Filtern", pro: "Suche mit allen Filtern", enterprise: "Suche mit allen Filtern" } },
  { label: "Treffer", tiers: { guest: "10 Treffer je Suche", basic: "20 Treffer je Suche", pro: "Alle Treffer", enterprise: "Alle Treffer" } },
  { label: "Artikel lesen und teilen", tiers: { guest: "Alle Artikel lesen und teilen", basic: "Alle Artikel lesen und teilen", pro: "Alle Artikel lesen und teilen", enterprise: "Alle Artikel lesen und teilen" } },
  { label: "Meine Suchen", tiers: { guest: null, basic: "5 gespeicherte Suchen", pro: `Bis zu ${PLAN_MAX} gespeicherte Suchen`, enterprise: `Bis zu ${PLAN_MAX} gespeicherte Suchen` } },
  { label: "Gespeicherte Artikel", tiers: { guest: null, basic: "5 gespeicherte Artikel", pro: `Bis zu ${PLAN_MAX} gespeicherte Artikel`, enterprise: `Bis zu ${PLAN_MAX} gespeicherte Artikel` } },
  { label: "E-Mail-Benachrichtigungen", tiers: { guest: null, basic: "5 Benachrichtigungen, täglich oder wöchentlich", pro: `Bis zu ${PLAN_MAX} Benachrichtigungen, auch sofort`, enterprise: `Bis zu ${PLAN_MAX} Benachrichtigungen, auch sofort` } },
  { label: "plenara.X", tiers: { guest: null, basic: null, pro: "plenara.X: alle Analysen, bundesweit", enterprise: "plenara.X: alle Analysen, bundesweit" } },
  { label: "Sitzungskalender mit Kalender-Abo", tiers: { guest: null, basic: null, pro: "Sitzungskalender mit Kalender-Abo", enterprise: "Sitzungskalender mit Kalender-Abo" } },
  { label: "Bis zu 5 E-Mail-Empfänger", tiers: { guest: null, basic: null, pro: null, enterprise: "Bis zu 5 E-Mail-Empfänger je Benachrichtigung" } },
];
const PLANS: { tier: Tier; note: string; nutzen: string }[] = [
  { tier: "guest", note: "Ohne Anmeldung", nutzen: "Suchen, filtern, lesen und teilen." },
  { tier: "basic", note: "Kostenlos, mit Anmeldung", nutzen: "Themen speichern und per E-Mail im Blick behalten." },
  { tier: "pro", note: "Monatlich kündbar", nutzen: "Alles: alle Treffer, plenara.X und der Sitzungskalender." },
  { tier: "enterprise", note: "Noch nicht im Angebot", nutzen: "Später mit KI, Team und Schnittstelle." },
];
/** Angebotene Stufen als Karten; ohne Anmeldung steht als Satz darüber, Enterprise gibt es noch nicht */
const SHOWN = PLANS.filter((p) => p.tier === "basic" || p.tier === "pro");

/* Wie im übrigen Design: schwarze Pille mit Pfeil für die Hauptaktion, sonst Petrol-Text mit Pfeil */
const PRIMARY = "mt-5 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white no-underline transition-opacity after:content-['→'] hover:opacity-85";
const SECONDARY = "mt-5 inline-flex h-11 items-center gap-1.5 self-start text-[14px] font-medium text-teal-700 no-underline after:content-['→'] after:transition-transform hover:after:translate-x-0.5 disabled:text-slate-400 disabled:after:content-none";

/** Tarifübersicht für Konto und Preisseite. Plus führt zur Buchung, solange der Server Bezahlung meldet (lib/booking.ts),
 *  sonst zur Anfrage über den Kontakt; in der Entwicklung lässt sich im Konto als Testkonto der Stufe anmelden */
export function PlanCards({ publicPage = false }: { publicPage?: boolean }) {
  const { tier } = useTier();
  const plus = usePlusLink();
  /* Handy: ein Tarif auf einmal; seitlich wischen oder die Reiter antippen (beides bleibt abgeglichen) */
  const [pick, setPick] = useState<Tier>(publicPage || !SHOWN.some((p) => p.tier === tier) ? "pro" : tier);
  const track = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);
  const goTo = (t: Tier, smooth: boolean) => {
    const el = track.current;
    const card = el?.children[SHOWN.findIndex((p) => p.tier === t)] as HTMLElement | undefined;
    if (el && card && el.scrollWidth > el.clientWidth) lockUntil.current = Date.now() + (smooth ? 700 : 100);
    if (el && card && el.scrollWidth > el.clientWidth) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  };
  /* Startkarte (Plus bzw. der eigene Tarif) ohne Animation in Sicht */
  useEffect(() => { goTo(pick, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = track.current;
    if (!el || el.scrollWidth <= el.clientWidth || Date.now() < lockUntil.current) return;
    const kids = [...el.children] as HTMLElement[];
    let best = 0;
    kids.forEach((k, i) => { if (Math.abs(k.offsetLeft - el.offsetLeft - el.scrollLeft) < Math.abs(kids[best].offsetLeft - el.offsetLeft - el.scrollLeft)) best = i; });
    const t = SHOWN[best].tier;
    if (t !== pick) setPick(t);
  };
  return (
    <section id="tarif" aria-labelledby="tarif-title" className={publicPage ? "" : "mt-6 scroll-mt-20"}>
      {!publicPage && <h2 id="tarif-title" className="m-0 text-[18px] font-semibold">Stufe</h2>}
      <p className="m-0 mt-3 text-[14px] text-slate-600">In ganz Deutschland suchen, filtern, lesen und teilen geht sofort, ohne Anmeldung (10 Treffer je Suche). Gesucht wird in allen Gebieten, für die wir Daten haben.</p>
      <div className="mt-3 sm:hidden"><Segmented label="Stufe wählen" fill options={SHOWN.map((p) => [p.tier, TIER_LABEL[p.tier]] as [typeof p.tier, string])} value={pick} onPick={(t) => { setPick(t); goTo(t, true); }} /></div>
      <div ref={track} onScroll={onScroll} className="mt-3 grid grid-cols-1 gap-x-8 gap-y-6 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-4 max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:grid-cols-2 lg:max-w-[760px]">
        {SHOWN.map((plan) => {
          const current = !publicPage && plan.tier === tier;
          return (
            <div key={plan.tier} className={`flex flex-col max-sm:w-full max-sm:flex-none max-sm:snap-start border-t-2 pb-2 pt-5 lg:pr-2 max-sm:rounded-2xl max-sm:border max-sm:border-t max-sm:p-4 max-sm:shadow-sm ${current ? "border-teal-600 max-sm:bg-teal-50/60" : plan.tier === "pro" && publicPage ? "border-slate-900 bg-slate-50 px-4 sm:-mt-2 sm:pt-7 max-sm:border-teal-600 max-sm:bg-white max-sm:shadow-md max-sm:ring-1 max-sm:ring-teal-600/30" : "border-slate-200 max-sm:bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[16px] font-semibold">{plan.tier === "guest" ? "Ohne Konto" : TIER_LABEL[plan.tier]}</h3>
                {current && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[12px] font-semibold text-white">{plan.tier === "guest" ? "Ihr Status" : "Ihre Stufe"}</span>}
                {publicPage && plan.tier === "pro" && <span className="text-[12px] font-semibold text-teal-800">Beliebt</span>}
              </div>
              <p className="m-0 mt-2 text-[22px] font-bold tracking-tight">{priceLabel(plan.tier)}</p>
              <p className="m-0 text-[12px] text-slate-500">{plan.note}</p>
              <p className="m-0 mt-3 text-[14px] font-medium leading-snug text-slate-900">{plan.nutzen}</p>
              <ul className="m-0 mt-4 flex-1 list-none space-y-1.5 p-0 text-[14px]">
                {FEATURES.map((f) => {
                  const text = f.tiers[plan.tier];
                  return text ? (
                    <li key={f.label} className="flex gap-2 text-slate-900">
                      <span aria-hidden="true" className="text-teal-700">✓</span>
                      {text}
                    </li>
                  ) : null;
                })}
              </ul>
              {publicPage ? (
                plan.tier === "basic" ? (
                  <Link href="/anmelden" className={SECONDARY}>
                    Kostenlos anmelden
                  </Link>
                ) : plan.tier === "pro" ? (
                  <Link href={plus.href} className={PRIMARY}>
                    {plus.label}
                  </Link>
                ) : (
                  <Link href="/kontakt" className={SECONDARY}>
                    {UPGRADE_TEXT}
                  </Link>
                )
              ) : !current &&
                (IS_DEV ? (
                  <button type="button" onClick={() => setTier(plan.tier)} className={plan.tier === "pro" ? PRIMARY : SECONDARY}>
                    {plan.tier === "guest" ? "Abmelden" : `Als ${TIER_LABEL[plan.tier]} anmelden`} (Dev)
                  </button>
                ) : plan.tier === "basic" ? null : (
                  <Link href={plan.tier === "pro" ? plus.href : "/kontakt"} className={plan.tier === "pro" ? PRIMARY : SECONDARY}>
                    {plan.tier === "pro" ? plus.label : UPGRADE_TEXT}
                  </Link>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Konto: nur der eigene Tarif mit seinen Leistungen und dem Ende eines Testzugangs; alle Tarife stehen auf der Preisseite */
export function PlanSummary() {
  const me = useMe();
  const { tier, user, tierUntil, tierSource } = me;
  const plan = PLANS.find((p) => p.tier === tier) ?? PLANS[0];
  const until = shortDate(tierUntil);
  /* Hinweis ab 14 Tagen vor dem Ende (AGB: Testzugang endet) */
  const ends = tierUntil ? Date.parse(tierUntil) : NaN;
  const soon = useClient(() => Number.isFinite(ends) && ends - Date.now() < 14 * 86400000, false);
  const name = tier === "guest" ? (user ? "Konto ohne freigeschaltete Stufe" : "Ohne Konto") : TIER_LABEL[tier];
  return (
    <section id="tarif" aria-labelledby="tarif-title" className="mt-6 scroll-mt-20">
      <h2 id="tarif-title" className="m-0 text-[18px] font-semibold">Stufe</h2>
      {/* Handy: die Stufe als Karte mit Abzeichen */}
      <div className="max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-teal-600/40 max-sm:bg-teal-50/60 max-sm:p-4">
      <p className="m-0 mt-3 max-sm:mt-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-semibold">
        {name}
        {tier !== "guest" && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[12px] font-semibold text-white sm:hidden">Ihre Stufe</span>}
        {tier !== "guest" && <span className="font-normal text-slate-500 max-sm:basis-full"><span className="max-sm:hidden">· </span>{priceLabel(tier)} · {plan.note}</span>}
      </p>
      {/* Abos über Stripe zeigen ihr Datum unter „Abo verwalten“; das Ende der Stufe enthält dort die Kulanz */}
      {until && tier !== "guest" && tierSource !== "stripe" && (
        <p className={`m-0 mt-1 text-[14px] ${soon ? "text-amber-800" : "text-slate-500"}`} role={soon ? "status" : undefined}>
          {tierSource === "beta" ? `Testzugang ${TIER_LABEL[tier]} bis ${until}` : `${TIER_LABEL[tier]} bis ${until}`}
          {soon && ". Danach gelten die Rechte des kostenlosen Kontos; Verlängerung auf Anfrage über den Kontakt."}
        </p>
      )}
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0 text-[14px]">
        {FEATURES.map((f) => {
          const text = f.tiers[tier];
          return text ? (
            <li key={f.label} className="flex gap-2 text-slate-900">
              <span aria-hidden="true" className="text-teal-700">✓</span>
              {text}
            </li>
          ) : null;
        })}
      </ul>
      </div>
      <Billing />
      <Link href="/preise" className={SECONDARY}>Alle Stufen ansehen</Link>
    </section>
  );
}

const RUNNING = ["active", "trialing", "past_due"];
/** Plus über Stripe buchen und verwalten (server/accounts/billing.mjs), nur wenn der Server Bezahlung meldet. Nach der
 *  Rückkehr aus dem Checkout (?zahlung=pruefen) fragt die Seite /api/me eine Minute lang nach, bis Stripe die Zahlung meldet. */
function Billing() {
  const me = useMe();
  const returned = useSearchParams().get("zahlung");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waited, setWaited] = useState(false);
  const paid = me.tier === "pro" || me.tier === "enterprise";
  const checking = returned === "pruefen" && !!me.billing && !paid && !waited;
  useEffect(() => {
    if (!checking) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      void reloadMe();
      if (tries >= 30) {
        window.clearInterval(timer);
        setWaited(true);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [checking]);
  const billing = me.billing;
  if (!billing || !me.user) return null;
  const sub = billing.subscription;
  const running = !!sub && RUNNING.includes(sub.status);
  const go = async (path: string) => {
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>(path, { method: "POST" });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : "Das hat nicht geklappt.");
      setBusy(false);
    }
  };
  return (
    <div className="mt-5 border-t border-slate-200 pt-4 text-[14px]">
      {checking && <p role="status" className="m-0 text-slate-600">Zahlung wird geprüft. Plus wird freigeschaltet, sobald Stripe die Zahlung bestätigt.</p>}
      {returned === "pruefen" && waited && !paid && <p role="status" className="m-0 text-amber-800">Die Bestätigung von Stripe ist noch nicht da. Bitte laden Sie die Seite in einigen Minuten neu.</p>}
      {returned === "pruefen" && paid && running && <p role="status" className="m-0 text-teal-800">Danke, Plus ist freigeschaltet.</p>}
      {returned === "abgebrochen" && !running && <p role="status" className="m-0 text-slate-600">Bezahlung abgebrochen. Es wurde nichts gebucht.</p>}
      {running && sub && (
        <p className={`m-0 mt-1 ${sub.status === "past_due" ? "text-amber-800" : "text-slate-600"}`}>
          {sub.status === "past_due" ? "Die letzte Zahlung ist offen. Bitte prüfen Sie die Zahlart unter „Abo verwalten“." : sub.cancelAt ? `Plus ist gekündigt und endet am ${shortDate(sub.cancelAt)}.` : `Plus verlängert sich am ${shortDate(sub.periodEnd)}.`}
        </p>
      )}
      {billing.test && <p className="m-0 mt-1 text-[12px] text-slate-500">Testmodus: Es wird kein echtes Geld abgebucht.</p>}
      <div className="flex flex-wrap gap-x-6">
        {!running && !paid && (
          <button type="button" disabled={busy} onClick={() => void go("/api/billing/checkout")} className={`${PRIMARY} disabled:opacity-50`}>
            Plus buchen · {priceLabel("pro")}
          </button>
        )}
        {billing.customer && (
          <button type="button" disabled={busy} onClick={() => void go("/api/billing/portal")} className={SECONDARY}>
            Abo verwalten
          </button>
        )}
      </div>
      {error && <p role="alert" className="m-0 mt-2 text-amber-800">{error}</p>}
    </div>
  );
}
