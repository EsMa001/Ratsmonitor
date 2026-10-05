import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useBrand } from "../lib/brand";
import { PageHead, Rich, useOpenSearch } from "./blocks";
import { PLANS, type PlanId } from "./content";
import { FilterSelect } from "../components/FilterSelect";
import { useRouter } from "next/navigation";
import { login, register, requestReset, TEST_PASSWORD } from "../lib/testAuth";
import { IS_DEV } from "../lib/tier";
import { Icon } from "./icons";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  help,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  autoComplete?: string;
}) {
  /* Passwortfelder: Eingabe per Auge-Knopf ein- und ausblendbar */
  const [shown, setShown] = useState(false);
  const isPw = type === "password";
  const input = (
    <input
      id={id}
      type={isPw && shown ? "text" : type}
      className="ri-input"
      style={isPw ? { paddingRight: 52 } : undefined}
      value={value}
      autoComplete={autoComplete}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? id + "-err" : help ? id + "-help" : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return (
    <div className="ri-field">
      <label htmlFor={id}>{label}</label>
      {isPw ? (
        <div style={{ position: "relative" }}>
          {input}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={shown}
            title={shown ? "Passwort verbergen" : "Passwort anzeigen"}
            style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "#64748b", cursor: "pointer", borderRadius: 10 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {shown && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
      ) : (
        input
      )}
      {error ? (
        <p id={id + "-err"} role="alert" className="ri-err">
          {error}
        </p>
      ) : (
        help && (
          <p id={id + "-help"} className="ri-help">
            {help}
          </p>
        )
      )}
    </div>
  );
}

/** Bestätigungsseite nach einem simulierten Formularversand */
export function DoneScreen({ title, children }: { title: string; children: ReactNode }) {
  const openSearch = useOpenSearch();
  return (
    <section className="ri-done">
      <span className="ri-done__icon">
        <Icon name="circleCheck" size={26} />
      </span>
      <h1>{title}</h1>
      <p>{children}</p>
      <button type="button" className="ri-btn ri-btn--dark" onClick={() => openSearch()}>
        Zur Suche
      </button>
      <span className="ri-proto">Testmodus: Gespeichert nur in diesem Browser, es wurde nichts versendet.</span>
    </section>
  );
}

const planOf = (v: string | null): PlanId => (v === "pro" || v === "enterprise" ? v : "free");

/* TODO: Registrierung an das Backend anbinden (Doku Kap. 8); bisher nur Validierung im Frontend */
export function RegisterPage() {
  const params = useSearchParams();
  const [plan, setPlan] = useState<PlanId>(() => planOf(params.get("tarif")));
  const [f, setF] = useState({ name: "", org: "", email: "", password: "", terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const p = PLANS.find((x) => x.id === plan)!;
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = "Bitte geben Sie Ihren Namen ein.";
    if (plan === "enterprise" && !f.org.trim()) err.org = "Bitte geben Sie Ihre Organisation ein.";
    if (!EMAIL.test(f.email.trim())) err.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
    if (f.password.length < 8) err.password = "Das Passwort muss mindestens 8 Zeichen lang sein.";
    if (!f.terms) err.terms = "Bitte akzeptieren Sie die AGB und die Datenschutzerklärung.";
    setErrors(err);
    if (Object.keys(err).length) {
      document.getElementById("reg-" + Object.keys(err)[0])?.focus();
      return;
    }
    /* Testmodus: Konto in diesem Browser anlegen, Bestätigungs-Mail ins Test-Postfach */
    const fail = await register({ name: f.name, org: f.org, email: f.email, password: f.password, tier: plan === "free" ? "basic" : plan });
    if (fail) {
      setErrors({ email: fail });
      return document.getElementById("reg-email")?.focus();
    }
    setDone(true);
    window.scrollTo(0, 0);
  };

  if (done)
    return <DoneScreen title="Konto angelegt">Sie sind angemeldet. Die Bestätigungs-E-Mail liegt im <Link href="/konto/postfach" className="ri-link">Test-Postfach</Link>.</DoneScreen>;

  const form = (
    <form className="ri-form" noValidate onSubmit={submit} aria-label="Registrierung">
      <div className="ri-plans" role="group" aria-label="Tarif">
        {PLANS.map((x) => (
          <button key={x.id} type="button" className="ri-plan" aria-pressed={x.id === plan} onClick={() => setPlan(x.id)}>
            <span className="ri-plan__name">{x.name}</span>
            <span className="ri-plan__price">{x.short}</span>
          </button>
        ))}
      </div>
      <Field id="reg-name" label="Name" value={f.name} onChange={set("name")} error={errors.name} autoComplete="name" />
      {plan === "enterprise" && <Field id="reg-org" label="Organisation" value={f.org} onChange={set("org")} error={errors.org} autoComplete="organization" />}
      <Field id="reg-email" label="E-Mail-Adresse" type="email" value={f.email} onChange={set("email")} error={errors.email} autoComplete="email" />
      <Field id="reg-password" label="Passwort" type="password" value={f.password} onChange={set("password")} error={errors.password} help="Mindestens 8 Zeichen" autoComplete="new-password" />
      <label className="ri-check">
        <input id="reg-terms" type="checkbox" checked={f.terms} onChange={(e) => set("terms")(e.target.checked)} aria-invalid={errors.terms ? true : undefined} />
        <span>
          Ich akzeptiere die{" "}
          <Link href="/agb" className="ri-link">
            AGB
          </Link>{" "}
          und habe die{" "}
          <Link href="/datenschutz" className="ri-link">
            Datenschutzerklärung
          </Link>{" "}
          gelesen.
        </span>
      </label>
      {errors.terms && (
        <p role="alert" className="ri-err">
          {errors.terms}
        </p>
      )}
      <button type="submit" className="ri-btn ri-btn--dark ri-btn--block ri-submit">
        {p.submit}
      </button>
      <p className="ri-form__foot">
        Bereits registriert?{" "}
        <Link href="/anmelden" className="ri-link">
          Anmelden
        </Link>
      </p>
    </form>
  );

  return (
    <PageHead icon="user" label="Konto" name="Registrierung" title="Konto erstellen" lead="In wenigen Sekunden startklar. Suchen speichern, Beschlüsse merken." small top aside={form}>
      <div className="ri-chosen">
        <h2 className="ri-pk__label">Gewählter Tarif</h2>
        <div className="ri-chosen__head">
          <span className="ri-chosen__name">{p.name}</span>
          <span className="ri-chosen__price">
            {p.amount} {p.unit}
          </span>
        </div>
        <hr className="ri-pk__hr" />
        <ul className="ri-checks">
          {p.features.slice(0, 4).map((x) => (
            <li key={x.text}>
              <Icon name={x.plus ? "plus" : "check"} size={14} />
              <span>
                <Rich text={x.text} />
              </span>
            </li>
          ))}
        </ul>
        <Link href="/preise" className="ri-chosen__change">
          Tarif ändern
        </Link>
      </div>
    </PageHead>
  );
}

/* Testmodus: Anmeldung gegen Testkonten in diesem Browser (lib/testAuth.ts), keine echten E-Mails */
export function LoginPage() {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!EMAIL.test(f.email.trim())) err.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
    if (!f.password) err.password = "Bitte geben Sie Ihr Passwort ein.";
    if (!Object.keys(err).length) {
      const fail = await login(f.email, f.password);
      if (!fail) return router.push("/");
      err.password = fail;
    }
    setErrors(err);
    if (err.email) document.getElementById("login-email")?.focus();
    else if (err.password) document.getElementById("login-password")?.focus();
  };
  const reset = async () => {
    if (!EMAIL.test(f.email.trim())) {
      setErrors({ email: "Bitte geben Sie zuerst Ihre E-Mail-Adresse ein." });
      return document.getElementById("login-email")?.focus();
    }
    await requestReset(f.email);
    setNote("Falls es ein Konto gibt, liegt die E-Mail jetzt im Test-Postfach.");
  };

  return (
    <>
      <PageHead icon="user" label="Konto" name="Anmelden" title="Willkommen zurück" lead="Melden Sie sich an, um Ihre gespeicherten Suchen und Bookmarks zu sehen." />
      <section className="ri-sec">
        <form className="ri-form ri-form--center" noValidate onSubmit={submit} aria-label="Anmelden">
          <Field id="login-email" label="E-Mail-Adresse" type="email" value={f.email} onChange={(v) => setF((s) => ({ ...s, email: v }))} error={errors.email} autoComplete="email" />
          <Field id="login-password" label="Passwort" type="password" value={f.password} onChange={(v) => setF((s) => ({ ...s, password: v }))} error={errors.password} autoComplete="current-password" />
          <button type="submit" className="ri-btn ri-btn--dark ri-btn--block ri-submit">
            Anmelden
          </button>
          {note && (
            <p role="status" className="ri-help">
              {note} <Link href="/konto/postfach" className="ri-link">Zum Test-Postfach</Link>
            </p>
          )}
          <p className="ri-form__foot">
            <button type="button" className="ri-link max-sm:py-[10px]" onClick={reset}>
              Passwort vergessen?
            </button>{" "}
            · Noch kein Konto?{" "}
            <Link href="/registrieren?tarif=free" className="ri-link">
              Registrieren
            </Link>
          </p>
          {IS_DEV && (
            <p className="ri-form__foot">
              {/* Nur Entwicklung: ohne Zugangsdaten als Enterprise-Testkonto anmelden */}
              <button
                type="button"
                className="ri-link max-sm:py-[10px]"
                onClick={async () => {
                  if (!(await login("enterprise@parlamo.test", TEST_PASSWORD))) router.push("/");
                }}
              >
                Dev: als Enterprise fortfahren
              </button>
            </p>
          )}
          <p className="ri-help">
            Testmodus: basic@parlamo.test, pro@parlamo.test oder enterprise@parlamo.test, Passwort „{TEST_PASSWORD}“. Alles bleibt in diesem Browser, es werden keine E-Mails verschickt.
          </p>
        </form>
      </section>
    </>
  );
}

const SUBJECTS = ["Allgemeine Frage", "Konto und Tarif", "Enterprise"];

/* TODO: Kontaktformular an das Backend anbinden (Doku Kap. 8); bisher nur Validierung im Frontend */
export function KontaktPage() {
  const openSearch = useOpenSearch();
  const { name } = useBrand();
  const [f, setF] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = "Bitte geben Sie Ihren Namen ein.";
    if (!EMAIL.test(f.email.trim())) err.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
    if (!f.message.trim()) err.message = "Bitte schreiben Sie uns eine Nachricht.";
    setErrors(err);
    if (Object.keys(err).length) {
      document.getElementById("kontakt-" + Object.keys(err)[0])?.focus();
      return;
    }
    setDone(true);
    window.scrollTo(0, 0);
  };

  if (done)
    return (
      <>
        <PageHead icon="mail" label="Hilfe" name="Kontakt" title="Danke für Ihre Nachricht" lead="Wir melden uns in der Regel innerhalb eines Werktags." />
        <section className="ri-sec">
          <button type="button" className="ri-btn ri-btn--dark" onClick={() => openSearch()}>
            Zur Suche
          </button>
          <span className="ri-proto">Prototyp: Es wurde nichts versendet.</span>
        </section>
      </>
    );

  return (
    <>
      <PageHead
        icon="mail"
        label="Hilfe"
        name="Kontakt"
        title="Schreiben Sie uns"
        lead={`Fragen zu ${name}, Ihrem Konto oder Enterprise? Wir antworten in der Regel innerhalb eines Werktags.`}
      />
      <section className="ri-sec">
        <form className="ri-form ri-form--center" noValidate onSubmit={submit} aria-label="Kontakt">
          <Field id="kontakt-name" label="Name" value={f.name} onChange={(v) => setF((s) => ({ ...s, name: v }))} error={errors.name} autoComplete="name" />
          <Field id="kontakt-email" label="E-Mail-Adresse" type="email" value={f.email} onChange={(v) => setF((s) => ({ ...s, email: v }))} error={errors.email} autoComplete="email" />
          <div className="ri-field">
            <label htmlFor="kontakt-subject">Betreff</label>
            {/* Eigene Auswahlliste statt Browser-Dropdown */}
            <FilterSelect id="kontakt-subject" label="Betreff" allLabel="" value={f.subject} options={SUBJECTS.map((x) => ({ value: x, label: x }))} onChange={(v) => setF((s) => ({ ...s, subject: v }))} highlight={false} className="[&_button]:!h-12 [&_button]:!w-full [&_button]:!max-w-none [&_button]:!text-[16px]" />
          </div>
          <div className="ri-field">
            <label htmlFor="kontakt-message">Nachricht</label>
            <textarea
              id="kontakt-message"
              className="ri-input"
              value={f.message}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? "kontakt-message-err" : undefined}
              onChange={(e) => setF((s) => ({ ...s, message: e.target.value }))}
            />
            {errors.message && (
              <p id="kontakt-message-err" role="alert" className="ri-err">
                {errors.message}
              </p>
            )}
          </div>
          <button type="submit" className="ri-btn ri-btn--dark ri-btn--block ri-submit">
            Nachricht senden
          </button>
        </form>
      </section>
    </>
  );
}
