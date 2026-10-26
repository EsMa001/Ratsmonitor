import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBrand } from "../lib/brand";
import { useClient } from "../lib/useClient";
import { InfoHints, PageHead } from "./blocks";
import { IS_DEV } from "../lib/tier";
import { AccountApiError, accountChanged, api, devLogin, logout, useMe } from "../lib/account";
import { BOOK_PATH } from "../lib/booking";
import { postponeImport } from "../lib/browserData";
import { safeNext } from "@/shared/safe-next.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Ziel nach der Anmeldung: dieselbe Prüfung wie auf dem Server (nach der Normalisierung, nur bekannte Pfade) */
const nextOf = (v: string | null | undefined) => safeNext(v ?? "/");

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  help,
  autoComplete,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "email" | "text";
  maxLength?: number;
}) {
  const described = [error ? id + "-err" : "", help ? id + "-help" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ri-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className="ri-input"
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(e) => onChange(e.target.value)}
      />
      {help && (
        <p id={id + "-help"} className="ri-help">
          {help}
        </p>
      )}
      {error && (
        <p id={id + "-err"} role="alert" className="ri-err">
          {error}
        </p>
      )}
    </div>
  );
}

/** Zustimmungen bei der ersten Anmeldung (Registrierung): AGB in der Fassung des Servers, Volljährigkeit, Name freiwillig */
interface Consent {
  agb: boolean;
  adult: boolean;
  name: string;
}
const NO_CONSENT: Consent = { agb: false, adult: false, name: "" };
function ConsentBlock({ id, value, onChange, errors }: { id: string; value: Consent; onChange: (c: Consent) => void; errors: { agb?: string; adult?: string } }) {
  return (
    <fieldset className="m-0 mt-5 border-0 p-0">
      <legend className="text-[16px] font-semibold text-slate-900">Neues Konto</legend>
      <p className="ri-help" style={{ marginTop: 4 }}>
        Für diese Adresse gibt es noch kein Konto. Mit der Bestätigung legen Sie es an.
      </p>
      <label className="ri-check">
        <input id={id + "-agb"} type="checkbox" checked={value.agb} onChange={(e) => onChange({ ...value, agb: e.target.checked })} aria-invalid={errors.agb ? true : undefined} aria-describedby={errors.agb ? id + "-agb-err" : undefined} />
        <span>
          Ich akzeptiere die{" "}
          <Link href="/agb" className="ri-link" target="_blank">
            AGB
          </Link>
          . Hinweise zur Verarbeitung meiner Daten stehen in der{" "}
          <Link href="/datenschutz" className="ri-link" target="_blank">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </label>
      {errors.agb && (
        <p id={id + "-agb-err"} role="alert" className="ri-err">
          {errors.agb}
        </p>
      )}
      <label className="ri-check">
        <input id={id + "-adult"} type="checkbox" checked={value.adult} onChange={(e) => onChange({ ...value, adult: e.target.checked })} aria-invalid={errors.adult ? true : undefined} aria-describedby={errors.adult ? id + "-adult-err" : undefined} />
        <span>Ich bin mindestens 18 Jahre alt.</span>
      </label>
      {errors.adult && (
        <p id={id + "-adult-err"} role="alert" className="ri-err">
          {errors.adult}
        </p>
      )}
      <div style={{ marginTop: 18 }}>
        <Field id={id + "-name"} label="Name (freiwillig)" value={value.name} onChange={(v) => onChange({ ...value, name: v })} autoComplete="name" maxLength={100} />
      </div>
    </fieldset>
  );
}
/** Fehler der Zustimmungen; leer, wenn alles da ist */
function consentErrors(c: Consent) {
  return { ...(c.agb ? {} : { agb: "Bitte akzeptieren Sie die AGB." }), ...(c.adult ? {} : { adult: "Bitte bestätigen Sie, dass Sie mindestens 18 Jahre alt sind." }) };
}
const consentBody = (c: Consent, version: string) => ({ agb: version, adult: true, ...(c.name.trim() ? { name: c.name.trim() } : {}) });

/** Hinweis in der geschlossenen Testphase (requirements/konten-konzept.md 6.5) */
function InviteNote() {
  return (
    <p className="ri-help" style={{ marginTop: 16 }}>
      Plenara ist in einer geschlossenen Testphase. Sie bekommen nur dann eine E-Mail, wenn diese Adresse eingeladen ist. Keine E-Mail? Adresse prüfen, Spam-Ordner ansehen oder{" "}
      <Link href="/kontakt" className="ri-link">
        Kontakt
      </Link>
      .
    </p>
  );
}

/** Absender der Anmeldemail: wie der Server ihn nennt (MAIL_FROM), sonst auf der eigenen Domain anmeldung@<domain>, sonst neutral */
function senderText(sender?: string): string {
  if (sender) return `von ${sender}`;
  if (typeof window === "undefined") return "von Plenara";
  const host = window.location.hostname.replace(/^www\./, "");
  const own = host.includes(".") && !/^[\d.]+$/.test(host) && !host.endsWith("sslip.io") && !host.endsWith(".localhost") && !host.endsWith(".test");
  return own ? `von anmeldung@${host}` : "von der Anmeldeadresse von Plenara";
}

const RESEND_SECONDS = 60;

/** Anmelden und Registrieren in einem: Adresse eingeben, Link oder Code aus der E-Mail */
export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const weiter = params.get("weiter");
  const next = nextOf(weiter);
  /* /admin verweist mit neu=1 hierher, wenn die Admin-Anmeldung älter als 7 Tage ist: trotz Sitzung neu anmelden (sonst
     zeigte die Seite nur „Weiter“ zurück zur Administration, die wieder hierher verwies) */
  const fresh = params.get("neu") === "1";
  /* Erster Besuch nach der Anmeldung: die Willkommensseite statt des Profils */
  const firstVisit = useClient(() => { try { return !localStorage.getItem("plenara.willkommen"); } catch { return false; } }, false);
  const [step, setStep] = useState<"email" | "wait">("email");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [emailError, setEmailError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [wait, setWait] = useState(0);
  const [consent, setConsent] = useState<{ version: string; value: Consent; errors: { agb?: string; adult?: string } } | null>(null);
  const [appCode, setAppCode] = useState("");
  const [appError, setAppError] = useState("");
  const [choice, setChoice] = useState<"mail" | "app" | null>(null);
  /* Neu anmelden: die Adresse des angemeldeten Kontos vorbelegen, sobald /api/me sie kennt (beim Rendern nachgezogen) */
  const [prefilled, setPrefilled] = useState(false);
  if (fresh && me.user && !prefilled) {
    setPrefilled(true);
    setEmail(me.user.email);
  }
  const askText = fresh
    ? "Ihre letzte Anmeldung ist älter als sieben Tage. Für die Administration bitte neu anmelden."
    : next === BOOK_PATH
      ? "Melden Sie sich an oder registrieren Sie sich kostenlos mit Ihrer E-Mail-Adresse. Danach geht es direkt weiter zur Buchung von Plus."
      : "Bitte melden Sie sich an, um diese Seite zu öffnen.";
  /* Wege laut Server: ohne Mailversand nur E-Mail-Adresse und Code aus der Authenticator-App (Konten mit zweitem Faktor) */
  const mailOn = me.login?.mail !== false;
  const appOn = me.login?.totp === true;
  const mode = choice ?? (mailOn || !appOn ? "mail" : "app");
  const heading = useRef<HTMLHeadingElement>(null);
  /* Nach dem Wechsel zum Wartebildschirm (und zurück) die neue Überschrift ansagen */
  useEffect(() => {
    if (step === "wait") heading.current?.focus();
    else if (sent) document.getElementById("login-email")?.focus();
  }, [step, sent]);
  /* Countdown für „Erneut senden“ */
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const request = async (address: string) => {
    setBusy(true);
    try {
      await api("/api/auth/link", { method: "POST", body: { email: address, next } });
      setSent(address);
      setStep("wait");
      setWait(RESEND_SECONDS);
      setStatus("");
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      if (step === "email") setEmailError(msg);
      else setStatus(msg);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL.test(v)) {
      setEmailError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
      return document.getElementById("login-email")?.focus();
    }
    setEmailError("");
    await request(v);
  };
  const resend = async () => {
    if (wait > 0 || busy) return;
    if (await request(sent)) setStatus("Neue E-Mail angefordert. Es gilt nur die neueste E-Mail.");
  };
  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCodeError("Bitte den achtstelligen Code aus der E-Mail eingeben.");
      return document.getElementById("login-code")?.focus();
    }
    let extra = {};
    if (consent) {
      const errors = consentErrors(consent.value);
      if (Object.keys(errors).length) {
        setConsent({ ...consent, errors });
        return document.getElementById("login-consent-" + Object.keys(errors)[0])?.focus();
      }
      extra = consentBody(consent.value, consent.version);
    }
    setBusy(true);
    setCodeError("");
    try {
      const r = await api<{ next?: string }>("/api/auth/code", { method: "POST", body: { code: digits, ...extra } });
      await accountChanged();
      router.push(nextOf(r.next ?? next));
    } catch (err) {
      if (err instanceof AccountApiError && err.status === 409 && err.data.needConsent) {
        /* Richtiger Code für eine neue Adresse: Zustimmungen fehlen, derselbe Code gilt weiter */
        setConsent({ version: String(err.data.agbVersion ?? ""), value: consent?.value ?? NO_CONSENT, errors: {} });
        setTimeout(() => document.getElementById("login-consent-agb")?.focus(), 0);
      } else {
        setCodeError((err as Error).message);
        document.getElementById("login-code")?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  const submitApp = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL.test(v)) {
      setEmailError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
      return document.getElementById("login-email")?.focus();
    }
    setEmailError("");
    const digits = appCode.replace(/\D/g, "");
    if (digits.length !== 6) {
      setAppError("Bitte den sechsstelligen Code aus der App eingeben.");
      return document.getElementById("login-app-code")?.focus();
    }
    setBusy(true);
    setAppError("");
    try {
      const r = await api<{ next?: string }>("/api/auth/totp-login", { method: "POST", body: { email: v, code: digits, next } });
      await accountChanged();
      router.push(nextOf(r.next ?? next));
    } catch (err) {
      /* Jeder Code gilt nur einmal: Feld leeren, auf den nächsten Code warten */
      setAppError((err as Error).message);
      setAppCode("");
      document.getElementById("login-app-code")?.focus();
    } finally {
      setBusy(false);
    }
  };

  /* Hinweis auf die geschlossene Testphase nur, solange neue Adressen eine Einladung brauchen (/api/me signup) */
  const invite = !me.signup && (me.access === "invite" || !!weiter);
  const lead = step === "wait" ? undefined : mode === "app" ? "Mit Ihrer E-Mail-Adresse und dem Code aus Ihrer Authenticator-App anmelden." : "Mit Ihrer E-Mail-Adresse anmelden. Sie erhalten einen Link und einen Code, ein Passwort gibt es nicht.";
  const hints = <InfoHints items={[{ icon: "heart", text: "Mit dem Konto speichern Sie Suchen und Artikel." }, { icon: "shieldCheck", text: "Sie können sich jederzeit abmelden." }]} />;
  const head = <PageHead icon="user" label="Konto" name="Anmelden" title={step === "wait" ? "E-Mail prüfen" : "Anmelden"} lead={lead} />;

  if (me.ready && me.user && !fresh)
    return (
      <>
        {head}
        <section className="ri-sec">
          <div className="ri-form ri-form--center">
            <p role="status" style={{ margin: 0, fontSize: 16 }}>
              Sie sind angemeldet als <strong>{me.user.email}</strong>.
            </p>
            <Link href={next === "/" ? (firstVisit ? "/konto/willkommen" : "/konto/profil") : next} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
              {next === "/" ? (firstVisit ? "Los geht's" : "Zum Konto") : "Weiter"}
            </Link>
            <p className="ri-form__foot">
              <button type="button" className="ri-link max-sm:py-[10px]" onClick={() => void logout()}>
                Abmelden
              </button>
            </p>
          </div>
          {hints}
        </section>
      </>
    );
  if (me.ready && !me.accounts)
    return (
      <>
        {head}
        <section className="ri-sec">
          <div className="ri-form ri-form--center">
            <p role="status" style={{ margin: 0, fontSize: 16 }}>
              Auf diesem Server gibt es keine Konten. Suche und Artikel sind ohne Anmeldung nutzbar.
            </p>
          </div>
        </section>
      </>
    );
  if (me.ready && !mailOn && !appOn)
    return (
      <>
        {head}
        <section className="ri-sec">
          <div className="ri-form ri-form--center">
            <p role="status" style={{ margin: 0, fontSize: 16 }}>
              Die Anmeldung ist noch nicht freigeschaltet. Suche und Artikel sind ohne Anmeldung nutzbar.
            </p>
          </div>
        </section>
      </>
    );

  return (
    <>
      {head}
      <section className="ri-sec">
        {mode === "app" && step === "email" ? (
          <form className="ri-form ri-form--center" noValidate onSubmit={submitApp} aria-label="Anmelden mit Authenticator-App">
            {weiter && (
              <p role="status" style={{ margin: "0 0 16px", fontSize: 16 }}>
                {askText}
              </p>
            )}
            <Field id="login-email" label="E-Mail-Adresse" type="email" value={email} onChange={setEmail} error={emailError} autoComplete="email" inputMode="email" />
            <Field id="login-app-code" label="Code aus der Authenticator-App" value={appCode} onChange={setAppCode} error={appError} help="6 Ziffern. Nur für freigeschaltete Konten mit eingerichteter App." autoComplete="one-time-code" inputMode="numeric" maxLength={7} />
            <button type="submit" disabled={busy} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
              {busy ? "Wird geprüft …" : "Anmelden"}
            </button>
            {mailOn && (
              <p className="ri-form__foot">
                <button
                  type="button"
                  className="ri-link max-sm:py-[10px]"
                  onClick={() => {
                    setChoice("mail");
                    setAppError("");
                  }}
                >
                  Stattdessen Link per E-Mail
                </button>
              </p>
            )}
            <p className="ri-help">
              <Link href="/datenschutz" className="ri-link">
                Hinweise zum Datenschutz
              </Link>
            </p>
            {IS_DEV && <DevLogin next={next} />}
          </form>
        ) : step === "email" ? (
          <form className="ri-form ri-form--center" noValidate onSubmit={submitEmail} aria-label="Anmelden">
            {weiter && (
              <p role="status" style={{ margin: "0 0 16px", fontSize: 16 }}>
                {askText}
              </p>
            )}
            <Field id="login-email" label="E-Mail-Adresse" type="email" value={email} onChange={setEmail} error={emailError} autoComplete="email" inputMode="email" />
            <button type="submit" disabled={busy} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
              {busy ? "Wird gesendet …" : "Link und Code anfordern"}
            </button>
            {appOn && (
              <p className="ri-form__foot">
                <button
                  type="button"
                  className="ri-link max-sm:py-[10px]"
                  onClick={() => {
                    setChoice("app");
                    setEmailError("");
                  }}
                >
                  Mit Authenticator-App anmelden
                </button>
              </p>
            )}
            <p className="ri-help">
              <Link href="/datenschutz" className="ri-link">
                Hinweise zum Datenschutz
              </Link>
            </p>
            {invite && <InviteNote />}
            {IS_DEV && <DevLogin next={next} />}
          </form>
        ) : (
          <div className="ri-form ri-form--center">
            <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
              E-Mail an {sent}
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
              {me.signup ? "In wenigen Minuten kommt eine E-Mail an " : "Wenn die Adresse für Plenara freigeschaltet ist, kommt in wenigen Minuten eine E-Mail an "}
              <strong>{sent}</strong>, {senderText(me.sender)}. Sie enthält einen Link und einen Code. Es gilt nur die neueste E-Mail.
            </p>
            <p className="ri-help">Keine E-Mail? Bitte auch im Spam- oder Quarantäneordner nachsehen.</p>
            <form noValidate onSubmit={submitCode} aria-label="Code eingeben" style={{ marginTop: 22 }}>
              <Field id="login-code" label="Code aus der E-Mail" value={code} onChange={setCode} error={codeError} help="8 Ziffern. Der Code gilt 15 Minuten und nur in diesem Browser." autoComplete="one-time-code" inputMode="numeric" maxLength={12} />
              {consent && <ConsentBlock id="login-consent" value={consent.value} onChange={(value) => setConsent({ ...consent, value, errors: {} })} errors={consent.errors} />}
              <button type="submit" disabled={busy} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                {busy ? "Wird geprüft …" : consent ? "Konto anlegen und anmelden" : "Anmelden"}
              </button>
            </form>
            <p className="ri-form__foot" style={{ fontSize: 14 }}>
              <button type="button" className="ri-link max-sm:py-[10px]" disabled={wait > 0 || busy} onClick={() => void resend()} aria-describedby="login-resend-help">
                {wait > 0 ? `Erneut senden (in ${wait} s)` : "Erneut senden"}
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="ri-link max-sm:py-[10px]"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setCodeError("");
                  setConsent(null);
                  setStatus("");
                }}
              >
                Andere Adresse
              </button>
            </p>
            <p id="login-resend-help" className="ri-help" style={{ textAlign: "center" }}>
              Höchstens 3 Links in 15 Minuten.
            </p>
            {status && (
              <p role="status" className="ri-help" style={{ textAlign: "center" }}>
                {status}
              </p>
            )}
            {invite && <InviteNote />}
          </div>
        )}
        {step !== "wait" && hints}
      </section>
    </>
  );
}

/** Nur Entwicklung: als Testkonto anmelden, ohne E-Mail (POST /api/dev/login) */
function DevLogin({ next }: { next: string }) {
  const router = useRouter();
  return (
    <p className="ri-form__foot" style={{ fontSize: 14 }}>
      Dev:{" "}
      {(["basic", "pro", "enterprise"] as const).map((t, i) => (
        <span key={t}>
          {i > 0 && " · "}
          <button type="button" className="ri-link max-sm:py-[10px]" onClick={() => void devLogin(t).then(() => router.push(next))}>
            als {t}@plenara.test
          </button>
        </span>
      ))}
    </p>
  );
}

/* Token aus dem Link (#t=…): einmal lesen und sofort aus der Adresse entfernen (auch bei doppeltem Effekt im Dev-Modus) */
let linkToken: string | null = null;
function takeToken(): string {
  /* Ein neuer Link (Anmelden, Abbestellen) ersetzt den gemerkten; ohne Fragment gilt der zuletzt gelesene */
  const m = /(?:^#|&)t=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (m || linkToken === null) {
    linkToken = m ? m[1] : "";
    if (window.location.hash) history.replaceState(history.state, "", window.location.pathname + window.location.search);
  }
  return linkToken;
}
type Peek = { valid: true; email: string; purpose: "login" | "signup"; sameBrowser: boolean; agbVersion?: string } | { valid: false; error: string };

/** Bestätigungsseite für den Link aus der E-Mail. Sendet nichts von selbst: erst der Klick löst den Link ein (Mail-Scanner). */
export function ConfirmLoginPage() {
  const router = useRouter();
  const [peek, setPeek] = useState<{ token: string; data: Peek } | null>(null);
  const [consent, setConsent] = useState<Consent>(NO_CONSENT);
  const [errors, setErrors] = useState<{ agb?: string; adult?: string }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const token = takeToken();
    let live = true;
    (token ? api<Peek>("/api/auth/peek", { method: "POST", body: { token } }) : Promise.resolve<Peek>({ valid: false, error: "In der Adresse fehlt der Anmeldelink. Bitte öffnen Sie den Link aus der E-Mail erneut oder geben Sie den Code ein." }))
      .catch((e: Error) => ({ valid: false as const, error: e.message }))
      .then((data) => live && setPeek({ token, data }));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (peek || done) heading.current?.focus();
  }, [peek, done]);

  const data = peek?.data;
  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!peek || !data?.valid) return;
    const signup = data.purpose === "signup";
    if (signup) {
      const errs = consentErrors(consent);
      setErrors(errs);
      if (Object.keys(errs).length) return document.getElementById("confirm-consent-" + Object.keys(errs)[0])?.focus();
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ next?: string }>("/api/auth/verify", { method: "POST", body: { token: peek.token, ...(signup ? consentBody(consent, data.agbVersion ?? "") : {}) } });
      /* Anmeldung kam nicht aus diesem Browser: die Übernahme der Browserdaten nicht von selbst anbieten */
      if (!data.sameBrowser) postponeImport();
      await accountChanged();
      setDone(nextOf(r.next ?? "/"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead icon="user" label="Konto" name="Anmelden" title="Anmeldung bestätigen" />
      <section className="ri-sec">
        <div className="ri-form ri-form--center">
          {!peek && (
            <p role="status" style={{ margin: 0 }}>
              Link wird geprüft …
            </p>
          )}
          {done !== null ? (
            <>
              <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
                Angemeldet
              </h2>
              <p role="status" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                Sie sind auf diesem Gerät angemeldet. Wollten Sie sich an einem anderen Gerät anmelden? Geben Sie dort den Code aus der E-Mail ein.
              </p>
              <button type="button" className="ri-btn ri-btn--dark ri-btn--block ri-submit" onClick={() => router.push(done)}>
                Weiter
              </button>
            </>
          ) : data && !data.valid ? (
            <>
              <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
                Link nicht gültig
              </h2>
              <p role="alert" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                {data.error}
              </p>
              <Link href="/anmelden" className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                Neuen Link anfordern
              </Link>
            </>
          ) : data?.valid ? (
            <form noValidate onSubmit={confirm} aria-label="Anmeldung bestätigen">
              <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none" style={{ overflowWrap: "anywhere" }}>
                Anmelden als {data.email}
              </h2>
              {!data.sameBrowser && (
                <p role="alert" style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.5, color: "var(--color-amber-800)" }}>
                  Diese Anmeldung wurde nicht in diesem Browser angefordert. Nur fortfahren, wenn Sie das selbst waren.
                </p>
              )}
              {data.purpose === "signup" && <ConsentBlock id="confirm-consent" value={consent} onChange={(c) => { setConsent(c); setErrors({}); }} errors={errors} />}
              {error && (
                <p role="alert" className="ri-err">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                {busy ? "Wird angemeldet …" : data.purpose === "signup" ? "Konto anlegen und anmelden" : "Anmelden"}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}

type Unsub = { kind: "all" | "search" | "article" | "calendar" | "billing"; title: string };
const UNSUB_WHAT: Record<Unsub["kind"], (t: string) => string> = {
  all: () => "alle Benachrichtigungen per E-Mail",
  search: (t) => (t ? `die Benachrichtigung zur Suche „${t}“` : "die Benachrichtigung zu dieser Suche"),
  article: (t) => (t ? `die Benachrichtigung zum Vorgang „${t}“` : "die Benachrichtigung zu diesem Vorgang"),
  calendar: () => "die E-Mails zu neuen Sitzungen in Ihren Kalendergebieten",
  billing: () => "die E-Mails zu Zahlungen und zum Ende von Plus",
};
/** Wo man das Abbestellte wieder einschaltet: Zahlungsmails im Profil unter „Stufe“, alles andere bei den Benachrichtigungen */
const unsubHome = (kind: Unsub["kind"]) => (kind === "billing" ? "/konto/profil" : "/konto/benachrichtigungen");

/** Abbestellen über den Link aus einer Benachrichtigung (#t=…, ohne Anmeldung). Wie beim Anmeldelink: erst der Klick
 *  bestellt ab, damit Prüfprogramme der Postfächer nichts auslösen. Suchen und Artikel bleiben gespeichert. */
export function UnsubscribePage() {
  const [peek, setPeek] = useState<{ token: string; data: Unsub | { error: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const token = takeToken();
    let live = true;
    (token ? api<Unsub>("/api/notify/unsubscribe", { method: "POST", body: { t: token, peek: true } }) : Promise.reject(new Error("In der Adresse fehlt der Link aus der E-Mail. Bitte öffnen Sie ihn erneut.")))
      .catch((e: Error) => ({ error: e.message }))
      .then((data) => live && setPeek({ token, data }));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (peek || done) heading.current?.focus();
  }, [peek, done]);
  const data = peek?.data;
  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!peek || !data || "error" in data) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/notify/unsubscribe", { method: "POST", body: { t: peek.token } });
      setDone(true);
      // Angemeldet zeigen Konto und andere Tabs danach den neuen Stand (Zahlungsmails stehen in /api/me)
      void accountChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const h2 = "m-0 text-[22px] font-semibold outline-none";
  return (
    <>
      <PageHead icon="bell" label="Konto" name="Benachrichtigungen" title="Abbestellen" />
      <section className="ri-sec">
        <div className="ri-form ri-form--center">
          {!peek && (
            <p role="status" style={{ margin: 0 }}>
              Link wird geprüft …
            </p>
          )}
          {done && data && !("error" in data) ? (
            <>
              <h2 ref={heading} tabIndex={-1} className={h2}>
                Abbestellt
              </h2>
              <p role="status" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                {data.kind === "billing"
                  ? `Sie erhalten ${UNSUB_WHAT.billing("")} nicht mehr. Rechnungen finden Sie weiter unter „Abo verwalten“; einschalten können Sie die E-Mails jederzeit wieder im Konto.`
                  : `Sie erhalten ${UNSUB_WHAT[data.kind](data.title)} nicht mehr. Ihre gespeicherten Suchen und Artikel bleiben erhalten; einschalten können Sie die Benachrichtigungen jederzeit wieder im Konto.`}
              </p>
              <Link href={unsubHome(data.kind)} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                {data.kind === "billing" ? "Zum Konto" : "Zu den Benachrichtigungen"}
              </Link>
            </>
          ) : data && "error" in data ? (
            <>
              <h2 ref={heading} tabIndex={-1} className={h2}>
                Link nicht gültig
              </h2>
              <p role="alert" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                {data.error}
              </p>
              <Link href="/konto/benachrichtigungen" className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                Im Konto ausschalten
              </Link>
            </>
          ) : data ? (
            <form noValidate onSubmit={confirm} aria-label="Benachrichtigung abbestellen">
              <h2 ref={heading} tabIndex={-1} className={h2} style={{ overflowWrap: "anywhere" }}>
                {data.kind === "all" ? "Alle Benachrichtigungen abbestellen?" : data.kind === "billing" ? "E-Mails zur Bezahlung abbestellen?" : "Benachrichtigung abbestellen?"}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                Sie erhalten danach {UNSUB_WHAT[data.kind](data.title)} nicht mehr.{" "}
                {data.kind === "billing" ? "Ihr Abo bleibt unverändert; Rechnungen finden Sie weiter unter „Abo verwalten“." : "Gespeicherte Suchen und Artikel bleiben erhalten."}
              </p>
              {error && (
                <p role="alert" className="ri-err">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                {busy ? "Wird abbestellt …" : "Abbestellen"}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}

/** Frühere Registrierung: Anmelden und Registrieren sind ein Weg (/anmelden); der Server leitet schon um */
export function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/anmelden");
  }, [router]);
  return null;
}

/** Kontakt per E-Mail. Ein Formular gibt es erst, wenn es an das Backend angebunden ist (Doku Kap. 8):
 *  vorher hätte es Nachrichten angenommen, die nie ankommen. */
const CONTACT = "kontakt@plenara.de";
export function KontaktPage() {
  const { name } = useBrand();
  return (
    <>
      <PageHead
        icon="mail"
        label="Hilfe"
        name="Kontakt"
        title={<>Schreiben Sie uns. Wir antworten schnell.</>}
        lead={`Fragen zu ${name}, Ihrem Konto oder einer Stufe für die Testphase? Wir antworten in der Regel innerhalb eines Werktags.`}
      />
      <section className="ri-sec">
        <div className="ri-form ri-form--center">
          <p style={{ margin: 0, fontSize: 16 }}>
            Schreiben Sie uns eine E-Mail an{" "}
            <a href={`mailto:${CONTACT}`} className="ri-link">
              {CONTACT}
            </a>
            .
          </p>
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Frage zu ${name}`)}`} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
            E-Mail schreiben
          </a>
        </div>
        <InfoHints items={[{ icon: "clock", text: "Antwort in der Regel innerhalb eines Werktags." }, { icon: "mail", text: "Für Fragen zu Konto, Stufen und Testphase." }]} />
      </section>
    </>
  );
}
