import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHead } from "../info/blocks";
import { AccountLoading } from "../components/TierNotice";
import { AccountApiError, api, useMe } from "../lib/account";
import { BOOK_PATH } from "../lib/booking";
import { priceLabel, TIER_LABEL, UPGRADE_TEXT } from "../lib/tier";

const PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white no-underline after:content-['→'] hover:opacity-85 disabled:opacity-50";
const SECONDARY = "inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-teal-700 no-underline after:content-['→']";

/**
 * Plus buchen (/konto/buchen): Ziel aller Plus-Knöpfe (lib/booking.ts). Ohne Anmeldung geht es erst zum Anmelden oder
 * kostenlosen Registrieren und danach von selbst hierher zurück; angemeldet startet die Seite einmal die Bezahlseite von
 * Stripe (POST /api/billing/checkout). Freigeschaltet wird erst nach der Bestätigung durch Stripe (Kontoseite, ?zahlung=pruefen).
 */
export function BookingPage() {
  const me = useMe();
  const router = useRouter();
  const [error, setError] = useState<{ text: string; booked: boolean } | null>(null);
  const started = useRef(false);
  const paid = me.tier === "pro" || me.tier === "enterprise";
  const ready = me.ready && !!me.user && !!me.checkout && !paid;
  /* Ohne Anmeldung: erst anmelden oder registrieren, danach zurück hierher */
  useEffect(() => {
    if (me.ready && me.accounts && !me.user) router.replace(`/anmelden?weiter=${encodeURIComponent(BOOK_PATH)}`);
  }, [me.ready, me.accounts, me.user, router]);
  const start = useCallback(async () => {
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST" });
      window.location.assign(url);
    } catch (e) {
      setError({ text: e instanceof AccountApiError ? e.message : "Die Bezahlseite konnte nicht geöffnet werden.", booked: e instanceof AccountApiError && e.status === 409 });
    }
  }, []);
  /* Angemeldet und buchbar: einmal weiter zur Bezahlseite; State setzt start() erst nach dem Abruf */
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void start();
  }, [ready, start]);

  const head = <PageHead icon="tag" label="Konto" name="Plus buchen" title="Plus buchen." lead={`${priceLabel("pro")}, monatlich kündbar. Bezahlt wird auf der Seite von Stripe.`} />;
  let body;
  if (!me.ready) body = <AccountLoading />;
  else if (!me.accounts) body = <p className="m-0 text-[16px] text-slate-600">Auf diesem Server gibt es keine Konten.</p>;
  else if (!me.user) body = <p role="status" className="m-0 text-[16px] text-slate-600">Weiter zur Anmeldung …</p>;
  else if (paid)
    body = (
      <>
        <p className="m-0 text-[16px] text-slate-900">Sie haben bereits {TIER_LABEL[me.tier]}.</p>
        <Link href="/konto/profil" className={`${SECONDARY} mt-4`}>Zum Konto</Link>
      </>
    );
  else if (!me.checkout)
    body = (
      <>
        <p className="m-0 text-[16px] text-slate-900">Plus lässt sich hier noch nicht buchen. Wir schalten es auf Anfrage frei.</p>
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
