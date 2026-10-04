import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useBrand } from "../lib/brand";
import { PageHead, Rich, useOpenSearch } from "./blocks";
import { PLANS, type PlanId } from "./content";
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
  return (
    <div className="ri-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className="ri-input"
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? id + "-err" : help ? id + "-help" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
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
      <span className="ri-proto">Prototyp: Es wurden keine Daten gespeichert oder versendet.</span>
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

  const submit = (e: FormEvent) => {
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
    setDone(true);
    window.scrollTo(0, 0);
  };

  if (done)
    return <DoneScreen title="Fast geschafft">Wir haben Ihnen eine E-Mail geschickt. Bestätigen Sie Ihre Adresse, dann ist Ihr Konto aktiv.</DoneScreen>;

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

/* TODO: Anmeldung an das Backend anbinden; „Passwort vergessen?“ hat noch kein Ziel (Doku Kap. 8) */
export function LoginPage() {
  const [f, setF] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!EMAIL.test(f.email.trim())) err.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
    if (!f.password) err.password = "Bitte geben Sie Ihr Passwort ein.";
    setErrors(err);
    setSent(!Object.keys(err).length);
    if (err.email) document.getElementById("login-email")?.focus();
    else if (err.password) document.getElementById("login-password")?.focus();
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
          {sent && (
            <p role="status" className="ri-help">
              Prototyp: Die Anmeldung ist noch nicht angebunden.
            </p>
          )}
          <p className="ri-form__foot">
            <a href="#" className="ri-link" onClick={(e) => e.preventDefault()}>
              Passwort vergessen?
            </a>{" "}
            · Noch kein Konto?{" "}
            <Link href="/registrieren?tarif=free" className="ri-link">
              Registrieren
            </Link>
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

  const submit = (e: FormEvent) => {
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
            <select id="kontakt-subject" className="ri-input" value={f.subject} onChange={(e) => setF((s) => ({ ...s, subject: e.target.value }))}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
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
