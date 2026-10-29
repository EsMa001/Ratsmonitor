import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AccountApiError, api, useMe } from "../lib/account";
import { BETREIBER } from "../lib/betreiber";
import { PageHead } from "./blocks";

/* Kündigungsbutton nach § 312k BGB (server/accounts/cancel.mjs, POST /api/billing/cancel). Erreichbar ohne Anmeldung über
   „Verträge hier kündigen“ (LEGAL in Footer.tsx). Diese Seite ist die Bestätigungsseite (Abs. 2): Art der Kündigung (bei
   außerordentlicher der Grund), E-Mail-Adresse des Kontos (Identifizierung und Adresse für die Bestätigung), Vertrag und
   Zeitpunkt; der Knopf heißt „jetzt kündigen“. Danach steht die Erklärung mit Datum und Uhrzeit des Eingangs zum Speichern
   oder Drucken da (Abs. 3), die Bestätigung kommt per Mail (Abs. 4). Die Antwort verrät nicht, ob es zur Adresse ein Konto gibt. */

type Kind = "ordinary" | "extraordinary";
type When = "next" | "date";
type FieldName = "email" | "reason" | "date";
interface Sent {
  receivedAt: string;
  contract: string;
  email: string;
  kind: Kind;
  reason: string;
  when: When;
  date: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KIND: Record<Kind, string> = { ordinary: "Ordentliche Kündigung", extraordinary: "Außerordentliche Kündigung" };
const BERLIN = { timeZone: "Europe/Berlin" } as const;
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deDay = (ymd: string) => ymd.split("-").reverse().join(".");
/** „26.10.2026 um 14:05 Uhr“ in deutscher Zeit, wie in der Bestätigungsmail */
const deTime = (at: string) => {
  const d = new Date(at);
  return `${d.toLocaleDateString("de-DE", { ...BERLIN, day: "2-digit", month: "2-digit", year: "numeric" })} um ${d.toLocaleTimeString("de-DE", { ...BERLIN, hour: "2-digit", minute: "2-digit" })} Uhr`;
};
const wanted = (s: Pick<Sent, "when" | "date">) => (s.when === "date" && s.date ? `zum ${deDay(s.date)}` : "zum nächstmöglichen Zeitpunkt");

function Choice({ name, value, checked, onPick, children }: { name: string; value: string; checked: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <label className="ri-check" style={{ marginTop: 10 }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onPick} />
      <span className="text-[16px] text-slate-900">{children}</span>
    </label>
  );
}

function Err({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} role="alert" className="ri-err">
      {text}
    </p>
  ) : null;
}

export function KuendigenPage() {
  const me = useMe();
  const [kind, setKind] = useState<Kind>("ordinary");
  const [reason, setReason] = useState("");
  // Angemeldet: Adresse des Kontos vorschlagen, bis man selbst etwas eingibt (null = noch nicht angefasst)
  const [typed, setTyped] = useState<string | null>(null);
  const email = typed ?? me.user?.email ?? "";
  const [when, setWhen] = useState<When>("next");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sent) heading.current?.focus();
  }, [sent]);

  const fail = (next: Partial<Record<FieldName, string>>) => {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById("kuendigen-" + first)?.focus();
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const next: Partial<Record<FieldName, string>> = {
      ...(EMAIL.test(email.trim()) ? {} : { email: "Bitte die E-Mail-Adresse Ihres Kontos angeben." }),
      ...(kind === "extraordinary" && !reason.trim() ? { reason: "Bitte den Grund der außerordentlichen Kündigung angeben." } : {}),
      ...(when === "date" && !(date && date >= localDay()) ? { date: "Bitte ein Datum ab heute angeben." } : {}),
    };
    fail(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      setSent(await api<Sent>("/api/billing/cancel", { method: "POST", body: { email: email.trim(), kind, reason: kind === "extraordinary" ? reason.trim() : "", when, date: when === "date" ? date : null } }));
    } catch (err) {
      const field = err instanceof AccountApiError ? err.data.field : undefined;
      if (field === "email" || field === "reason" || field === "date") fail({ [field]: (err as Error).message });
      else setError((err as Error).message || "Das hat nicht geklappt. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const h2 = "m-0 text-[22px] font-semibold outline-none";
  const legend = "mb-1 p-0 text-[16px] font-semibold text-slate-900";
  return (
    <>
      <PageHead icon="fileText" label="Rechtliches" name="Kündigen" title="Verträge hier kündigen" lead="Plenara Plus oder Pro kündigen, ohne Anmeldung. Die Bestätigung kommt sofort per E-Mail." />
      <section className="ri-sec">
        <div className="ri-form ri-form--center">
          {sent ? (
            <>
              <h2 ref={heading} tabIndex={-1} className={h2}>
                Kündigung eingegangen
              </h2>
              <p role="status" className="text-[16px] leading-normal" style={{ margin: "8px 0 0" }}>
                Ihre Kündigung ist am {deTime(sent.receivedAt)} bei uns eingegangen.
              </p>
              <dl className="m-0 mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[16px]">
                <dt className="text-slate-500">Vertrag</dt>
                <dd className="m-0 text-slate-900">{sent.contract}</dd>
                <dt className="text-slate-500">Art</dt>
                <dd className="m-0 text-slate-900">{KIND[sent.kind]}</dd>
                {sent.kind === "extraordinary" && sent.reason && (
                  <>
                    <dt className="text-slate-500">Grund</dt>
                    <dd className="m-0 whitespace-pre-line break-words text-slate-900">{sent.reason}</dd>
                  </>
                )}
                <dt className="text-slate-500">Zeitpunkt</dt>
                <dd className="m-0 text-slate-900">{wanted(sent)}</dd>
                <dt className="text-slate-500">E-Mail</dt>
                <dd className="m-0 break-all text-slate-900">{sent.email}</dd>
              </dl>
              <p className="text-[16px] leading-normal" style={{ margin: "16px 0 0" }}>
                Die Bestätigung mit dem Ende Ihres Vertrags schicken wir an diese Adresse. Keine E-Mail? Bitte den Spam-Ordner ansehen oder an{" "}
                <a href={`mailto:${BETREIBER.email}`} className="ri-link">
                  {BETREIBER.email}
                </a>{" "}
                schreiben.
              </p>
              <p className="ri-help">Speichern oder drucken Sie diese Seite als Nachweis Ihrer Kündigung.</p>
              <button type="button" onClick={() => window.print()} className="ri-btn ri-btn--dark ri-btn--block ri-submit print:hidden">
                Drucken oder als PDF speichern
              </button>
            </>
          ) : (
            <form noValidate onSubmit={submit} aria-label="Vertrag kündigen">
              <fieldset className="m-0 border-0 p-0">
                <legend className={legend}>Art der Kündigung</legend>
                <Choice name="kind" value="ordinary" checked={kind === "ordinary"} onPick={() => setKind("ordinary")}>
                  Ordentliche Kündigung
                </Choice>
                <Choice name="kind" value="extraordinary" checked={kind === "extraordinary"} onPick={() => setKind("extraordinary")}>
                  Außerordentliche Kündigung (aus wichtigem Grund)
                </Choice>
              </fieldset>
              {kind === "extraordinary" && (
                <div className="ri-field" style={{ marginTop: 18 }}>
                  <label htmlFor="kuendigen-reason">Grund der Kündigung</label>
                  <textarea id="kuendigen-reason" className="ri-input" value={reason} maxLength={2000} aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? "kuendigen-reason-err" : undefined} onChange={(e) => setReason(e.target.value)} />
                  <Err id="kuendigen-reason-err" text={errors.reason} />
                </div>
              )}

              <div className="ri-field" style={{ marginTop: 22 }}>
                <p className="m-0 mb-2 text-[16px] font-semibold text-slate-900">Vertrag</p>
                <p className="m-0 text-[16px] text-slate-700">Plenara-Abo (Stufe Plus oder Pro)</p>
              </div>

              <div className="ri-field" style={{ marginTop: 22 }}>
                <label htmlFor="kuendigen-email">E-Mail-Adresse Ihres Kontos</label>
                <input id="kuendigen-email" type="email" className="ri-input" value={email} autoComplete="email" inputMode="email" maxLength={254} aria-invalid={errors.email ? true : undefined} aria-describedby={["kuendigen-email-help", errors.email ? "kuendigen-email-err" : ""].filter(Boolean).join(" ")} onChange={(e) => setTyped(e.target.value)} />
                <p id="kuendigen-email-help" className="ri-help">
                  Daran erkennen wir Ihren Vertrag. An diese Adresse schicken wir die Bestätigung.
                </p>
                <Err id="kuendigen-email-err" text={errors.email} />
              </div>

              <fieldset className="m-0 mt-[22px] border-0 p-0">
                <legend className={legend}>Zeitpunkt</legend>
                <Choice name="when" value="next" checked={when === "next"} onPick={() => setWhen("next")}>
                  Zum nächstmöglichen Zeitpunkt
                </Choice>
                <Choice name="when" value="date" checked={when === "date"} onPick={() => setWhen("date")}>
                  Zu einem bestimmten Tag
                </Choice>
                {when === "date" && (
                  <div className="ri-field" style={{ marginTop: 12 }}>
                    <label htmlFor="kuendigen-date">Vertrag endet am</label>
                    <input id="kuendigen-date" type="date" className="ri-input" value={date} min={localDay()} aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? "kuendigen-date-err" : undefined} onChange={(e) => setDate(e.target.value)} />
                    <Err id="kuendigen-date-err" text={errors.date} />
                  </div>
                )}
                <p className="ri-help">Das Abo endet frühestens mit dem bereits bezahlten Monat; danach wird nichts mehr abgebucht.</p>
              </fieldset>

              {error && (
                <p role="alert" className="ri-err">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="ri-btn ri-btn--dark ri-btn--bare ri-btn--block ri-submit">
                {busy ? "Wird gesendet …" : "jetzt kündigen"}
              </button>
              <p className="ri-help">
                Angemeldet können Sie Ihr Abo auch im <Link href="/konto/profil" className="ri-link">Konto</Link> unter „Abo verwalten“ kündigen.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
