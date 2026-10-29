import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHead } from "../info/blocks";
import { AccountLoading } from "../components/TierNotice";
import { planFeatures } from "../components/PlanCards";
import { AccountApiError, api, useMe } from "../lib/account";
import { bookHref, type Bookable } from "../lib/booking";
import { priceLabel, rankOf, TIER_LABEL, UPGRADE_TEXT } from "../lib/tier";

const PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white no-underline after:content-['→'] hover:opacity-85 disabled:opacity-50";
const SECONDARY = "inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-teal-700 no-underline after:content-['→'] disabled:opacity-50";
const RUNNING = ["active", "trialing", "past_due"];
const OPTIONS: { tier: Bookable; nutzen: string }[] = [
  { tier: "plus", nutzen: "Alle Treffer, plenara.X und jede Woche ein Bericht zu Ihren Suchen." },
  { tier: "pro", nutzen: "Alles unbegrenzt, Mails je Suche bis täglich." },
];

/**
 * Plus oder Pro buchen (/konto/buchen): Ziel aller Buchungsknöpfe (lib/booking.ts). Beide Stufen stehen zur Wahl, ?stufe=pro
 * wählt vor. Ohne Anmeldung geht es erst zum Anmelden oder kostenlosen Registrieren und danach hierher zurück. Ohne Abo startet
 * der Knopf die Bezahlseite von Stripe (POST /api/billing/checkout {tier}); mit laufendem Abo öffnet er die Bestätigung des
 * Wechsels im Kundenportal (POST /api/billing/portal {tier}). Freigeschaltet wird erst nach der Bestätigung durch Stripe
 * (Kontoseite, ?zahlung=pruefen).
 */
export function BookingPage() {
  const me = useMe();
  const router = useRouter();
  const wanted: Bookable = useSearchParams().get("stufe") === "pro" ? "pro" : "plus";
  const [busy, setBusy] = useState<Bookable | null>(null);
  const [error, setError] = useState("");
  /* Ohne Anmeldung: erst anmelden oder registrieren, danach zurück hierher (mit der vorgewählten Stufe) */
  useEffect(() => {
    if (me.ready && me.accounts && !me.user) router.replace(bookHref(me, wanted));
  }, [me, wanted, router]);
  const sub = me.billing?.subscription;
  const subscribed = !!sub && RUNNING.includes(sub.status);
  const bookable = me.checkout ? (me.bookable ?? ["plus"]) : [];
  const go = async (tier: Bookable) => {
    setBusy(tier);
    setError("");
    try {
      const { url } = await api<{ url: string }>(subscribed ? "/api/billing/portal" : "/api/billing/checkout", { method: "POST", body: { tier } });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : "Die Bezahlseite konnte nicht geöffnet werden.");
      setBusy(null);
    }
  };

  const head = <PageHead icon="tag" label="Konto" name="Buchen" title="Plus oder Pro buchen." lead="Monatlich kündbar. Bezahlt wird auf der Seite von Stripe." />;
  let body;
  if (!me.ready) body = <AccountLoading />;
  else if (!me.accounts) body = <p className="m-0 text-[16px] text-slate-600">Auf diesem Server gibt es keine Konten.</p>;
  else if (!me.user) body = <p role="status" className="m-0 text-[16px] text-slate-600">Weiter zur Anmeldung …</p>;
  else
    body = (
      <>
        {subscribed && sub && (
          <p className="m-0 mb-4 text-[16px] text-slate-900">
            Sie haben {TIER_LABEL[sub.tier ?? "plus"]} gebucht. Ein Wechsel geht über Stripe: nach oben sofort, der Unterschied wird anteilig berechnet; nach unten zum Ende des bezahlten Monats.
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:max-w-[760px]">
          {OPTIONS.map(({ tier, nutzen }) => {
            /* Gebucht: die Stufe des laufenden Abos; sonst reicht die eigene Stufe (Freischaltung von Hand) schon */
            const booked = subscribed ? sub?.tier === tier : rankOf(me.tier) >= rankOf(tier);
            const can = bookable.includes(tier);
            const picked = tier === wanted;
            return (
              <div key={tier} className={`flex flex-col rounded-2xl border p-5 ${picked ? "border-teal-600 ring-1 ring-teal-600/30" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-[18px] font-semibold text-slate-900">{TIER_LABEL[tier]}</h2>
                  {booked ? <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[12px] font-semibold text-white">Ihre Stufe</span> : picked && <span className="text-[12px] font-semibold text-teal-800">Ausgewählt</span>}
                </div>
                <p className="m-0 mt-2 text-[22px] font-bold tracking-tight">{priceLabel(tier)}</p>
                <p className="m-0 mt-2 text-[14px] font-medium text-slate-900">{nutzen}</p>
                <ul className="m-0 mt-3 flex-1 list-none space-y-1.5 p-0 text-[14px]">
                  {planFeatures(tier).map((t) => (
                    <li key={t} className="flex gap-2 text-slate-900">
                      <span aria-hidden="true" className="text-teal-700">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {booked ? (
                    <Link href="/konto/profil" className={SECONDARY}>Zum Konto</Link>
                  ) : !can ? (
                    <Link href="/kontakt" className={SECONDARY}>{UPGRADE_TEXT}</Link>
                  ) : (
                    <button type="button" disabled={!!busy} onClick={() => void go(tier)} className={picked ? PRIMARY : SECONDARY}>
                      {busy === tier ? "Wird geöffnet …" : subscribed ? `Zu ${TIER_LABEL[tier]} wechseln` : `${TIER_LABEL[tier]} buchen`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {error && <p role="alert" className="m-0 mt-4 text-[16px] text-amber-800">{error}</p>}
        {me.billing?.test && <p className="m-0 mt-4 text-[14px] text-slate-500">Testmodus: Es wird kein echtes Geld abgebucht.</p>}
        {!bookable.length && <p className="m-0 mt-4 text-[14px] text-slate-500">Plus und Pro lassen sich hier noch nicht buchen. Wir schalten sie auf Anfrage frei.</p>}
      </>
    );
  return (
    <>
      {head}
      <section className="ri-sec ri-sec--tight">{body}</section>
    </>
  );
}
