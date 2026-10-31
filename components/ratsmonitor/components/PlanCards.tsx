import { Segmented } from "./Segmented";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { freqsLabel, IS_DEV, LIMITS, OFFERED, priceLabel, rankOf, setTier, TIER_LABEL, unlimited, UPGRADE_TEXT, useTier, type Tier } from "../lib/tier";
import { AccountApiError, api, reloadMe, shortDate, useMe } from "../lib/account";
import { usePlusLink, type Bookable } from "../lib/booking";
import { useClient } from "../lib/useClient";
import { FEATURES as PLAN_FEATURES } from "@/shared/plans.mjs";

/* Leistungen je Stufe aus den Grenzen in shared/plans.mjs (lib/tier.ts): Text, wenn enthalten, sonst null (steht in der Vergleichstabelle) */
const many = (n: number, one: string, more: string) => (unlimited(n) ? `Unbegrenzt viele ${more}` : n === 1 ? `1 ${one}` : `${n} ${more}`);
const FEATURES: { label: string; text: (t: Tier) => string | null }[] = [
  { label: "Ganz Deutschland", text: () => "Ganz Deutschland: alle Gebiete mit Daten" },
  { label: "Suche", text: (t) => (LIMITS[t].filters ? "Suche mit allen Filtern" : "Suche nach Begriff und Ort") },
  { label: "Treffer", text: (t) => (Number.isFinite(LIMITS[t].maxResults) ? `${LIMITS[t].maxResults} Treffer je Suche` : "Alle Treffer") },
  { label: "Artikel lesen und teilen", text: () => "Alle Artikel lesen und teilen" },
  { label: "Meine Suchen", text: (t) => (LIMITS[t].savedSearches ? many(LIMITS[t].savedSearches, "gespeicherte Suche", "gespeicherte Suchen") : null) },
  { label: "Gespeicherte Artikel", text: (t) => (LIMITS[t].bookmarks ? many(LIMITS[t].bookmarks, "gespeicherter Artikel", "gespeicherte Artikel") : null) },
  {
    label: "E-Mail-Benachrichtigungen",
    text: (t) => {
      const l = LIMITS[t];
      if (!l.notifications) return null;
      if (l.freqs.includes("daily")) return "Benachrichtigungen je Suche, täglich oder wöchentlich";
      if (l.weeklyReport) return "Wochenbericht zu allen Suchen und gefolgten Vorgängen";
      return `${many(l.notifications, "Benachrichtigung", "Benachrichtigungen")} per E-Mail, ${freqsLabel(l)}`;
    },
  },
  { label: "Sitzungskalender", text: (t) => (LIMITS[t].calendarAreas ? `Sitzungskalender mit Kalender-Abo, ${unlimited(LIMITS[t].calendarAreas) ? "unbegrenzt viele Gebiete" : LIMITS[t].calendarAreas === 1 ? "1 Gebiet" : `${LIMITS[t].calendarAreas} Gebiete`}` : null) },
  { label: "plenara.X", text: (t) => (t === "plus" || t === "pro" || t === "enterprise" ? "plenara.X: alle Analysen, bundesweit" : null) },
  { label: "Dokumentsuche", text: (t) => ((PLAN_FEATURES as Record<string, { fulltext: boolean }>)[t]?.fulltext ? "Dokumentsuche: findet Begriffe in den Texten der Sitzungsunterlagen" : null) },
  { label: "E-Mail-Empfänger", text: (t) => (LIMITS[t].emails > 1 ? `Bis zu ${LIMITS[t].emails} E-Mail-Empfänger je Benachrichtigung` : null) },
];
/** Leistungen einer Stufe als Sätze (Buchungsseite, Tarifkarten) */
export const planFeatures = (t: Tier) => FEATURES.map((f) => f.text(t)).filter((x): x is string => !!x);
const PLANS: { tier: Tier; note: string; nutzen: string }[] = [
  { tier: "guest", note: "Ohne Anmeldung", nutzen: "Suchen, lesen und teilen." },
  { tier: "basic", note: "Kostenlos, mit Anmeldung", nutzen: "Ein Thema speichern und per E-Mail im Blick behalten." },
  { tier: "plus", note: "Monatlich kündbar", nutzen: "Alle Treffer, plenara.X und jede Woche ein Bericht zu Ihren Suchen." },
  { tier: "pro", note: "Monatlich kündbar", nutzen: "Alles unbegrenzt, Dokumentsuche und Mails je Suche bis täglich." },
  { tier: "enterprise", note: "Noch nicht im Angebot", nutzen: "Später mit KI, Team und Schnittstelle." },
];
/** Angebotene Stufen als Karten (Konto, Plus, Pro); ohne Anmeldung steht als Satz darüber, Enterprise gibt es noch nicht */
const SHOWN = PLANS.filter((p) => OFFERED.includes(p.tier));

/* Wie im übrigen Design: schwarze Pille mit Pfeil für die Hauptaktion, sonst Petrol-Text mit Pfeil */
const PRIMARY = "mt-5 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white no-underline transition-opacity after:content-['→'] hover:opacity-85";
const SECONDARY = "mt-5 inline-flex h-11 items-center gap-1.5 self-start text-[14px] font-medium text-teal-700 no-underline after:content-['→'] after:transition-transform hover:after:translate-x-0.5 disabled:text-slate-400 disabled:after:content-none";

/** Tarifübersicht für Konto und Preisseite. Plus und Pro führen zur Buchung, solange der Server Bezahlung meldet
 *  (lib/booking.ts), sonst zur Anfrage über den Kontakt; in der Entwicklung lässt sich im Konto als Testkonto der Stufe anmelden */
export function PlanCards({ publicPage = false }: { publicPage?: boolean }) {
  const { tier } = useTier();
  const links: Record<Bookable, ReturnType<typeof usePlusLink>> = { plus: usePlusLink("plus"), pro: usePlusLink("pro") };
  const bookLink = (t: Tier) => (t === "plus" || t === "pro" ? links[t] : null);
  /* Handy: ein Tarif auf einmal; seitlich wischen oder die Reiter antippen (beides bleibt abgeglichen) */
  const [pick, setPick] = useState<Tier>(publicPage || !SHOWN.some((p) => p.tier === tier) ? "plus" : tier);
  const track = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);
  const goTo = (t: Tier, smooth: boolean) => {
    const el = track.current;
    const card = el?.children[SHOWN.findIndex((p) => p.tier === t)] as HTMLElement | undefined;
    if (el && card && el.scrollWidth > el.clientWidth) lockUntil.current = Date.now() + (smooth ? 700 : 100);
    if (el && card && el.scrollWidth > el.clientWidth) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  };
  /* Startkarte (Plus bzw. die eigene Stufe) ohne Animation in Sicht */
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
      <p className="m-0 mt-3 text-[14px] text-slate-600">In ganz Deutschland suchen, lesen und teilen geht sofort, ohne Anmeldung ({LIMITS.guest.maxResults} Treffer je Suche, nach Begriff und Ort). Gesucht wird in allen Gebieten, für die wir Daten haben.</p>
      <div className="mt-3 sm:hidden"><Segmented label="Stufe wählen" fill options={SHOWN.map((p) => [p.tier, TIER_LABEL[p.tier]] as [typeof p.tier, string])} value={pick} onPick={(t) => { setPick(t); goTo(t, true); }} /></div>
      <div ref={track} onScroll={onScroll} className="mt-3 grid grid-cols-1 gap-x-8 gap-y-6 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-4 max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:grid-cols-3 lg:max-w-[1080px]">
        {SHOWN.map((plan) => {
          const current = !publicPage && plan.tier === tier;
          const link = bookLink(plan.tier);
          return (
            <div key={plan.tier} className={`flex flex-col max-sm:w-full max-sm:flex-none max-sm:snap-start border-t-2 pb-2 pt-5 lg:pr-2 max-sm:rounded-2xl max-sm:border max-sm:border-t max-sm:p-4 max-sm:shadow-sm ${current ? "border-teal-600 max-sm:bg-teal-50/60" : plan.tier === "plus" && publicPage ? "border-slate-900 bg-slate-50 px-4 sm:-mt-2 sm:pt-7 max-sm:border-teal-600 max-sm:bg-white max-sm:shadow-md max-sm:ring-1 max-sm:ring-teal-600/30" : "border-slate-200 max-sm:bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[16px] font-semibold">{plan.tier === "guest" ? "Ohne Konto" : TIER_LABEL[plan.tier]}</h3>
                {current && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[12px] font-semibold text-white">{plan.tier === "guest" ? "Ihr Status" : "Ihre Stufe"}</span>}
                {publicPage && plan.tier === "plus" && <span className="text-[12px] font-semibold text-teal-800">Beliebt</span>}
              </div>
              <p className="m-0 mt-2 text-[22px] font-bold tracking-tight">{priceLabel(plan.tier)}</p>
              <p className="m-0 text-[12px] text-slate-500">{plan.note}</p>
              <p className="m-0 mt-3 text-[14px] font-medium leading-snug text-slate-900">{plan.nutzen}</p>
              <ul className="m-0 mt-4 flex-1 list-none space-y-1.5 p-0 text-[14px]">
                {FEATURES.map((f) => {
                  const text = f.text(plan.tier);
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
                ) : link ? (
                  <Link href={link.href} className={PRIMARY}>
                    {link.label}
                  </Link>
                ) : (
                  <Link href="/kontakt" className={SECONDARY}>
                    {UPGRADE_TEXT}
                  </Link>
                )
              ) : !current &&
                (IS_DEV ? (
                  <button type="button" onClick={() => setTier(plan.tier)} className={rankOf(plan.tier) > rankOf(tier) ? PRIMARY : SECONDARY}>
                    {plan.tier === "guest" ? "Abmelden" : `Als ${TIER_LABEL[plan.tier]} anmelden`} (Dev)
                  </button>
                ) : !link || rankOf(plan.tier) <= rankOf(tier) ? null : (
                  <Link href={link.href} className={PRIMARY}>
                    {link.label}
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
          const text = f.text(tier);
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
/** Plus oder Pro über Stripe buchen und verwalten (server/accounts/billing.mjs), nur wenn der Server Bezahlung meldet. Nach
 *  der Rückkehr aus dem Checkout (?zahlung=pruefen) fragt die Seite /api/me eine Minute lang nach, bis Stripe die Zahlung
 *  meldet. Mit laufendem Abo wechselt „Abo verwalten“ (Kundenportal) zwischen Plus und Pro. */
function Billing() {
  const me = useMe();
  const returned = useSearchParams().get("zahlung");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waited, setWaited] = useState(false);
  const paid = rankOf(me.tier) >= rankOf("plus");
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
  const booked = TIER_LABEL[sub?.tier ?? "plus"];
  const bookable = (me.bookable ?? ["plus"]).filter((t): t is Bookable => t === "plus" || t === "pro");
  const go = async (path: string, body?: { tier: Bookable }) => {
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>(path, { method: "POST", body });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : "Das hat nicht geklappt.");
      setBusy(false);
    }
  };
  return (
    <div className="mt-5 border-t border-slate-200 pt-4 text-[14px]">
      {checking && <p role="status" className="m-0 text-slate-600">Zahlung wird geprüft. Ihre Stufe wird freigeschaltet, sobald Stripe die Zahlung bestätigt.</p>}
      {returned === "pruefen" && waited && !paid && <p role="status" className="m-0 text-amber-800">Die Bestätigung von Stripe ist noch nicht da. Bitte laden Sie die Seite in einigen Minuten neu.</p>}
      {returned === "pruefen" && paid && running && <p role="status" className="m-0 text-teal-800">Danke, {TIER_LABEL[me.tier]} ist freigeschaltet.</p>}
      {returned === "abgebrochen" && !running && <p role="status" className="m-0 text-slate-600">Bezahlung abgebrochen. Es wurde nichts gebucht.</p>}
      {running && sub && (
        <p className={`m-0 mt-1 ${sub.status === "past_due" ? "text-amber-800" : "text-slate-600"}`}>
          {sub.status === "past_due" ? "Die letzte Zahlung ist offen. Bitte prüfen Sie die Zahlart unter „Abo verwalten“." : sub.cancelAt ? `${booked} ist gekündigt und endet am ${shortDate(sub.cancelAt)}.` : `${booked} verlängert sich am ${shortDate(sub.periodEnd)}.`}
        </p>
      )}
      {billing.test && <p className="m-0 mt-1 text-[12px] text-slate-500">Testmodus: Es wird kein echtes Geld abgebucht.</p>}
      <div className="flex flex-wrap gap-x-6">
        {!running &&
          !paid &&
          bookable.map((t) => (
            <button key={t} type="button" disabled={busy} onClick={() => void go("/api/billing/checkout", { tier: t })} className={`${PRIMARY} disabled:opacity-50`}>
              {TIER_LABEL[t]} buchen · {priceLabel(t)}
            </button>
          ))}
        {running && bookable.length > 1 && (
          <Link href={`/konto/buchen?stufe=${sub?.tier === "pro" ? "plus" : "pro"}`} className={SECONDARY}>
            Zu {sub?.tier === "pro" ? "Plus" : "Pro"} wechseln
          </Link>
        )}
        {billing.customer && (
          <button type="button" disabled={busy} onClick={() => void go("/api/billing/portal")} className={SECONDARY}>
            Abo verwalten
          </button>
        )}
      </div>
      {error && <p role="alert" className="m-0 mt-2 text-amber-800">{error}</p>}
      {(billing.customer || sub) && <BillingMails on={billing.mails} />}
    </div>
  );
}

/** Mails zu Zahlungen und zum Ende des Abos (server/accounts/billing.mjs sendBillingMail); auch per Link in jeder dieser Mails abbestellbar */
function BillingMails({ on }: { on: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = async (next: boolean) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/me/settings", { method: "PUT", body: { billingMails: next } });
      await reloadMe();
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <label className="mt-4 flex items-start gap-3 text-slate-600">
        <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void toggle(e.target.checked)} className="mt-[3px] h-4 w-4 flex-none accent-teal-700" />
        <span>E-Mails zu Zahlungen und zum Ende Ihres Abos</span>
      </label>
      {error && <p role="alert" className="m-0 mt-2 text-amber-800">{error}</p>}
    </>
  );
}
