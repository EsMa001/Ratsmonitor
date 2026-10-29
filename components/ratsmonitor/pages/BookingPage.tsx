import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHead } from "../info/blocks";
import { AccountLoading } from "../components/TierNotice";
import { AccountApiError, api, useMe } from "../lib/account";
import { bookHref, type Bookable } from "../lib/booking";
import { priceLabel, rankOf, TIER_LABEL, UPGRADE_TEXT } from "../lib/tier";

const PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white no-underline after:content-['→'] hover:opacity-85 disabled:opacity-50";
const SECONDARY = "inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-teal-700 no-underline after:content-['→']";

/**
 * Plus oder Pro buchen (/konto/buchen, Pro mit ?stufe=pro): Ziel aller Buchungsknöpfe (lib/booking.ts). Ohne Anmeldung geht
 * es erst zum Anmelden oder kostenlosen Registrieren und danach von selbst hierher zurück; angemeldet startet die Seite einmal
 * die Bezahlseite von Stripe (POST /api/billing/checkout {tier}). Freigeschaltet wird erst nach der Bestätigung durch Stripe
 * (Kontoseite, ?zahlung=pruefen). Wer schon ein Abo hat, wechselt die Stufe im Kundenportal („Abo verwalten“).
 */
export function BookingPage() {
  const me = useMe();
  const router = useRouter();
  const wanted: Bookable = useSearchParams().get("stufe") === "pro" ? "pro" : "plus";
  const label = TIER_LABEL[wanted];
  const [error, setError] = useState<{ text: string; booked: boolean } | null>(null);
  const started = useRef(false);
  /* Schon diese Stufe oder darüber; ein laufendes Abo wechselt im Kundenportal */
  const reached = rankOf(me.tier) >= rankOf(wanted);
  const subscribed = !!me.billing?.subscription && ["active", "trialing", "past_due"].includes(me.billing.subscription.status);
  const bookable = !!me.checkout && (me.bookable ?? ["plus"]).includes(wanted);
  const ready = me.ready && !!me.user && bookable && !reached && !subscribed;
  /* Ohne Anmeldung: erst anmelden oder registrieren, danach zurück hierher */
  useEffect(() => {
    if (me.ready && me.accounts && !me.user) router.replace(bookHref(me, wanted));
  }, [me, wanted, router]);
  const start = useCallback(async () => {
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST", body: { tier: wanted } });
      window.location.assign(url);
    } catch (e) {
      setError({ text: e instanceof AccountApiError ? e.message : "Die Bezahlseite konnte nicht geöffnet werden.", booked: e instanceof AccountApiError && e.status === 409 });
    }
  }, [wanted]);
  /* Angemeldet und buchbar: einmal weiter zur Bezahlseite; State setzt start() erst nach dem Abruf */
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void start();
  }, [ready, start]);

  const head = <PageHead icon="tag" label="Konto" name={`${label} buchen`} title={`${label} buchen.`} lead={`${priceLabel(wanted)}, monatlich kündbar. Bezahlt wird auf der Seite von Stripe.`} />;
  let body;
  if (!me.ready) body = <AccountLoading />;
  else if (!me.accounts) body = <p className="m-0 text-[16px] text-slate-600">Auf diesem Server gibt es keine Konten.</p>;
  else if (!me.user) body = <p role="status" className="m-0 text-[16px] text-slate-600">Weiter zur Anmeldung …</p>;
  else if (reached)
    body = (
      <>
        <p className="m-0 text-[16px] text-slate-900">Sie haben bereits {TIER_LABEL[me.tier]}.</p>
        <Link href="/konto/profil" className={`${SECONDARY} mt-4`}>Zum Konto</Link>
      </>
    );
  else if (subscribed && bookable)
    body = (
      <>
        <p className="m-0 text-[16px] text-slate-900">Sie haben bereits ein Abo. Zu {label} wechseln Sie im Konto unter „Abo verwalten“; der Unterschied wird anteilig berechnet.</p>
        <Link href="/konto/profil" className={`${PRIMARY} mt-4`}>Zum Konto</Link>
      </>
    );
  else if (!bookable)
    body = (
      <>
        <p className="m-0 text-[16px] text-slate-900">{label} lässt sich hier noch nicht buchen. Wir schalten es auf Anfrage frei.</p>
        <Link href="/kontakt" className={`${PRIMARY} mt-4`}>{UPGRADE_TEXT}</Link>
      </>
    );
  else if (error)
    body = (
      <>
        <p role="alert" className={`m-0 text-[16px] ${error.booked ? "text-slate-900" : "text-amber-800"}`}>{error.text}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {!error.booked && (
            <button type="button" className={PRIMARY} onClick={() => { setError(null); void start(); }}>
              Noch einmal versuchen
            </button>
          )}
          <Link href="/konto/profil" className={SECONDARY}>Zum Konto</Link>
        </div>
      </>
    );
  else
    body = (
      <>
        <p role="status" className="m-0 text-[16px] text-slate-900">Sie werden zur Bezahlseite von Stripe weitergeleitet …</p>
        {me.billing?.test && <p className="m-0 mt-2 text-[14px] text-slate-500">Testmodus: Es wird kein echtes Geld abgebucht.</p>}
      </>
    );
  return (
    <>
      {head}
      <section className="ri-sec ri-sec--tight">{body}</section>
    </>
  );
}
