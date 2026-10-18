import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useToast } from "../state/toast";
import { useAccount } from "../state/account";
import { useData } from "../state/data";
import { confirmDialog } from "../components/ConfirmDialog";
import { PlanSummary } from "../components/PlanCards";
import { AccountLoading, LoginRequired } from "../components/TierNotice";
import { CalendarFeed } from "../components/CalendarFeed";
import { PageHead } from "../info/blocks";
import { AccountApiError, accountChanged, api, logout, shortDate, touchAccount, useMe } from "../lib/account";
import { buildPayload, discardLocal, downloadFile, hasLocal, importFile, importLocal, localSummary, resultText, saveLocalFile, useLocalData } from "../lib/browserData";
import { clearRecent } from "../lib/recentSearches";

const field = "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-[14px] outline-none hover:border-slate-300 focus:border-teal-600 focus:shadow-focus";
const label = "mb-1 block text-[12px] font-semibold uppercase tracking-wide text-slate-500";
const h2 = "m-0 text-[18px] font-semibold";
const block = "mt-10 border-t border-slate-200 pt-6";
const link = "text-[14px] font-medium text-teal-700 hover:underline disabled:opacity-50 max-sm:inline-flex max-sm:min-h-[44px] max-sm:items-center";

/** Kontoseite: Angaben, Stufe, Geräte, Kalender-Abo, Daten aus diesem Browser, Datenauskunft, Löschen, Abmelden */
export function ProfilePage() {
  const me = useMe();
  const account = useAccount();
  if (!me.ready)
    return (
      <>
        <PageHead icon="user" label="Konto" name="Mein Konto" />
        <section className="ri-sec ri-sec--tight">
          <AccountLoading />
        </section>
      </>
    );
  if (!me.user)
    return (
      <>
        <PageHead icon="user" label="Konto" name="Mein Konto" title={<>Sie sind nicht angemeldet.</>} lead="Ohne Anmeldung: 10 Treffer je Suche. Mit Konto: Suchen und Artikel speichern." />
        <section className="ri-sec ri-sec--tight">
          <LoginRequired title="Anmelden" text="Mit einer Stufe: alle Treffer, Filter, gespeicherte Suchen und Artikel." />
          <PlanSummary />
          <BrowserData signedIn={false} />
        </section>
      </>
    );
  return (
    <>
      <PageHead icon="user" label="Konto" name="Mein Konto" title={<>Ihre Angaben. Ihre Stufe.</>} lead="Angaben, Stufe, angemeldete Geräte und Ihre Daten an einem Ort." />
      <section className="ri-sec ri-sec--tight">
        {account.ready && !account.saved.length && (
          <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-[16px] text-slate-900">Erster Schritt: Suche speichern, Glocke einschalten, per E-Mail informiert werden.</span>
            <Link href="/suche" className="text-[14px] font-medium text-teal-700 no-underline hover:underline">Zur Suche →</Link>
          </div>
        )}
        <Personal />
        <PlanSummary />
        <Devices />
        {me.features.calendar && (
          <section className={block} aria-labelledby="abo-title">
            <h2 id="abo-title" className={h2}>Kalender-Abo</h2>
            <p className="m-0 mt-1 text-[14px] text-slate-500">
              Sitzungen Ihrer <Link href="/konto/kalender" className="text-teal-700 hover:underline">Kalendergebiete</Link> in Apple Kalender, Outlook oder Google Kalender.
            </p>
            <CalendarFeed />
          </section>
        )}
        <BrowserData signedIn />
        <Export />
        <DeleteAccount />
        <div className={block}>
          <SignOut />
        </div>
      </section>
    </>
  );
}

/** Name ändern; die Adresse ist nur lesbar (Änderung in der Testphase über den Kontakt) */
function Personal() {
  const me = useMe();
  const toast = useToast();
  const saved = me.user?.name ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = draft ?? saved;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/me/settings", { method: "PUT", body: { name: name.trim() } });
      await accountChanged();
      setDraft(null);
      toast("Name gespeichert.");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void save(e)}>
      <h2 className={`${h2} sm:col-span-2`}>Persönliche Angaben</h2>
      <label>
        <span className={label}>Name</span>
        <input className={field} value={name} maxLength={120} onChange={(e) => setDraft(e.target.value)} placeholder="Vor- und Nachname" autoComplete="name" />
      </label>
      <div>
        <label htmlFor="profil-email" className={label}>E-Mail</label>
        <input id="profil-email" type="email" className={`${field} bg-slate-50 text-slate-600`} value={me.user?.email ?? ""} readOnly aria-describedby="profil-email-help" />
        <p id="profil-email-help" className="m-0 mt-1 text-[12px] text-slate-500">
          Adresse ändern: bitte über <Link href="/kontakt" className="text-teal-700 hover:underline">Kontakt</Link>.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 sm:col-span-2">
        <button type="submit" disabled={busy || draft === null || name.trim() === saved} className="btn-primary">
          Speichern
        </button>
      </div>
    </form>
  );
}

type Session = { id: string; device: string; since: string; lastSeen: string; current: boolean };
const day = (d: string) => shortDate(d);
/** Angemeldete Geräte: einzeln, alle anderen oder überall abmelden */
function Devices() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const key = me.user ? `${me.user.id}:${me.rev}` : "";
  const [list, setList] = useState<{ key: string; sessions: Session[] | null; error: string }>({ key: "", sessions: null, error: "" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!key) return;
    let live = true;
    api<{ sessions?: Session[] }>("/api/me/sessions").then(
      (d) => live && setList({ key, sessions: d.sessions ?? [], error: "" }),
      (e: Error) => live && setList({ key, sessions: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [key, tick]);
  const sessions = list.key === key ? list.sessions : null;
  const revoke = async (what: string, current: boolean) => {
    const text = what === "all" ? "Sie werden auf allen Geräten abgemeldet, auch hier." : what === "others" ? "Alle anderen Geräte werden abgemeldet. Dieses Gerät bleibt angemeldet." : current ? "Sie werden auf diesem Gerät abgemeldet." : "Das Gerät wird abgemeldet.";
    if (!(await confirmDialog({ title: what === "all" ? "Überall abmelden?" : what === "others" ? "Alle anderen abmelden?" : "Gerät abmelden?", text, confirmLabel: "Abmelden" }))) return;
    try {
      await api("/api/me/sessions", { method: "POST", body: { revoke: what } });
      if (what === "all" || current) {
        await logout();
        router.push("/");
        return;
      }
      touchAccount();
      setTick((t) => t + 1);
      toast(what === "others" ? "Alle anderen Geräte abgemeldet." : "Gerät abgemeldet.");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  /* Lange Listen kürzen: das eigene Gerät zuerst, dann die neuesten, höchstens 3 */
  const [all, setAll] = useState(false);
  const shown = sessions ? (all || sessions.length <= 3 ? sessions : [...sessions].sort((a, b) => Number(!!b.current) - Number(!!a.current)).slice(0, 3)) : [];
  return (
    <section className={block} aria-labelledby="geraete-title">
      <h2 id="geraete-title" className={h2}>Angemeldete Geräte</h2>
      {list.key === key && list.error && <p role="alert" className="m-0 mt-2 text-[14px] text-amber-700">{list.error}</p>}
      {!sessions && !(list.key === key && list.error) && <p role="status" className="m-0 mt-2 text-[14px] text-slate-500">Geräte werden geladen …</p>}
      {sessions && (
        <ul className="m-0 mt-3 list-none p-0">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 py-3 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] text-slate-900">
                  {s.device || "Unbekanntes Gerät"}
                  {s.current && <span className="ml-2 text-[12px] font-semibold text-teal-700">Dieses Gerät</span>}
                </span>
                <span className="block text-[12px] text-slate-500">
                  Angemeldet seit {day(s.since)} · zuletzt genutzt {day(s.lastSeen)}
                </span>
              </span>
              <button type="button" className={link} onClick={() => void revoke(s.id, s.current)}>
                Abmelden
              </button>
            </li>
          ))}
        </ul>
      )}
      {sessions && sessions.length > 3 && (
        <button type="button" className={`${link} mt-2`} onClick={() => setAll(!all)}>{all ? "Weniger zeigen" : `Alle ${sessions.length} Geräte zeigen`}</button>
      )}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {sessions && sessions.length > 1 && (
          <button type="button" className={link} onClick={() => void revoke("others", false)}>
            Alle anderen abmelden
          </button>
        )}
        <button type="button" className={link} onClick={() => void revoke("all", true)}>
          Überall abmelden
        </button>
      </div>
    </section>
  );
}

/** Daten aus diesem Browser (aus der Zeit vor den Konten): übernehmen, als Datei sichern, verwerfen; Datei übernehmen */
function BrowserData({ signedIn }: { signedIn: boolean }) {
  const local = useLocalData();
  const me = useMe();
  const { geo, place, geoError } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const any = hasLocal(local);
  if (!any && !signedIn) return null;
  const mapWait = !geo && !geoError && (local.searches.length > 0 || local.calendar.some((a) => a.km > 0));
  const take = async () => {
    setBusy(true);
    setError("");
    try {
      const server = await api<{ weekly?: boolean; weeklyDay?: number | null }>("/api/me/settings").catch(() => undefined);
      setResult(resultText(await importLocal(local, await buildPayload(local, geo, place, server))) + ".");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    if (!(await confirmDialog({ title: "Daten aus diesem Browser löschen?", text: `${localSummary(local)} werden in diesem Browser gelöscht. Vorher können Sie sie als Datei sichern.`, confirmLabel: "Löschen" }))) return;
    discardLocal();
    toast("Daten aus diesem Browser gelöscht.");
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      setResult(resultText(await importFile(f)) + ".");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };
  return (
    <section className={block} aria-labelledby="browser-title">
      <h2 id="browser-title" className={h2}>Daten aus diesem Browser</h2>
      {any && !local.imported && (
        <p className="m-0 mt-2 text-[14px] text-slate-900">
          {localSummary(local)} aus diesem Browser {signedIn ? "noch nicht übernommen" : "können Sie nach der Anmeldung in Ihr Konto übernehmen"}.
        </p>
      )}
      {any && local.imported && (
        <div className="mt-2 text-[14px] text-slate-600">
          <p className="m-0">Nicht übernommen und weiter nur in diesem Browser:</p>
          <ul className="m-0 mt-1 list-disc pl-5">
            {local.searches.map((s) => (
              <li key={s.id}>Suche „{s.name}“</li>
            ))}
            {local.articles.map((a) => (
              <li key={a.id}>Artikel „{a.title}“</li>
            ))}
            {local.calendar.length > 0 && <li>Kalender mit {local.calendar.length} Gebieten</li>}
          </ul>
        </div>
      )}
      {!any && <p className="m-0 mt-2 text-[14px] text-slate-500">In diesem Browser liegen keine Daten aus der Zeit vor den Konten. Eine gesicherte Datei können Sie hier übernehmen.</p>}
      {error && <p role="alert" className="m-0 mt-2 text-[14px] text-amber-700">{error}</p>}
      {result && <p role="status" className="m-0 mt-2 text-[14px] text-teal-700">{result}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        {any && signedIn && !local.imported && (
          <button type="button" disabled={busy || mapWait} className={link} onClick={() => void take()}>
            {busy ? "Wird übernommen …" : mapWait ? "Karte wird geladen …" : `In das Konto ${me.user?.email ?? ""} übernehmen →`}
          </button>
        )}
        {any && (
          <button type="button" className={link} onClick={() => void saveLocalFile(local, geo, place)}>
            Daten aus diesem Browser als Datei sichern →
          </button>
        )}
        {signedIn && (
          <>
            <input ref={file} id="import-file" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
            <button type="button" disabled={busy} className={link} onClick={() => file.current?.click()}>
              Datei übernehmen →
            </button>
          </>
        )}
        {any && (
          <button type="button" className="text-[14px] text-amber-700 underline underline-offset-2" onClick={() => void discard()}>
            {local.imported ? "Verwerfen" : "Nicht übernehmen und löschen"}
          </button>
        )}
      </div>
    </section>
  );
}

/** Code-Schritt für Datenauskunft und Löschen (Code per E-Mail, gilt nur in diesem Browser) */
function CodeForm({ id, label: submit, busy, error, onSubmit, onCancel, danger = false }: { id: string; label: string; busy: boolean; error: string; onSubmit: (code: string) => void; onCancel: () => void; danger?: boolean }) {
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <form
      noValidate
      className="mt-3 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code.replace(/\D/g, ""));
      }}
    >
      <div className="min-w-[200px]">
        <label htmlFor={id} className={label}>Code aus der E-Mail</label>
        <input ref={ref} id={id} className={field} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={12} aria-invalid={error ? true : undefined} aria-describedby={error ? id + "-err" : undefined} />
      </div>
      <button type="submit" disabled={busy} className={danger ? "inline-flex h-11 items-center rounded-full bg-amber-700 px-5 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50" : "btn-primary"}>
        {submit}
      </button>
      <button type="button" onClick={onCancel} className="btn-secondary">
        Abbrechen
      </button>
      {error && (
        <p id={id + "-err"} role="alert" className="m-0 w-full text-[14px] text-amber-700">
          {error}
        </p>
      )}
    </form>
  );
}

/** Datenauskunft (JSON); mit älterer Anmeldung (über 24 h) erst nach einem Code per E-Mail */
function Export() {
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const run = async (code?: string) => {
    setBusy(true);
    setError("");
    try {
      const d = await api<Record<string, unknown>>("/api/me/export", { method: "POST", body: code === undefined ? {} : { code } });
      if (d.codeSent) {
        setStep("code");
        setStatus("Wir haben Ihnen einen Code geschickt. Ihre letzte Anmeldung liegt über 24 Stunden zurück.");
        return;
      }
      downloadFile(JSON.stringify(d, null, 2), `plenara-daten-${new Date().toISOString().slice(0, 10)}.json`);
      setStep("idle");
      setStatus("Datei erstellt. Sie bekommen dazu eine Hinweis-E-Mail.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={block} aria-labelledby="export-title">
      <h2 id="export-title" className={h2}>Ihre Daten</h2>
      <p className="m-0 mt-1 text-[14px] text-slate-500">Alle Daten Ihres Kontos als Datei (JSON): Angaben, Stufe, Zustimmungen, gespeicherte Suchen und Artikel, Geräte und Anmeldungen.</p>
      {status && <p role="status" className="m-0 mt-2 text-[14px] text-slate-600">{status}</p>}
      {step === "idle" ? (
        <>
          {error && <p role="alert" className="m-0 mt-2 text-[14px] text-amber-700">{error}</p>}
          <button type="button" disabled={busy} className={`${link} mt-3`} onClick={() => void run()}>
            {busy ? "Wird erstellt …" : "Daten herunterladen →"}
          </button>
        </>
      ) : (
        <CodeForm id="export-code" label="Herunterladen" busy={busy} error={error} onSubmit={(c) => void run(c)} onCancel={() => { setStep("idle"); setError(""); setStatus(""); }} />
      )}
    </section>
  );
}

/** Konto löschen: zwei Schritte, der zweite mit einem Code per E-Mail */
function DeleteAccount() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    if (!(await confirmDialog({ title: "Konto löschen?", text: "Wir schicken Ihnen einen Code. Mit ihm wird das Konto endgültig gelöscht, samt Suchen, Artikeln und Einstellungen.", confirmLabel: "Code anfordern" }))) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/me/delete", { method: "POST" });
      setStep("code");
    } catch (e) {
      setError(e instanceof AccountApiError && e.status === 403 ? "Admin-Konten können hier nicht gelöscht werden." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const finish = async (code: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/me/delete", { method: "POST", body: { code } });
      clearRecent();
      await accountChanged();
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={block} aria-labelledby="delete-title">
      <h2 id="delete-title" className={h2}>Konto löschen</h2>
      {step === "idle" ? (
        <>
          <p className="m-0 mt-1 text-[14px] text-slate-500">Löscht das Konto mit allen gespeicherten Suchen, Artikeln und Einstellungen.</p>
          {error && <p role="alert" className="m-0 mt-2 text-[14px] text-amber-700">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void start()} className="mt-3 text-[14px] text-amber-700 underline underline-offset-2 disabled:opacity-50">
            Konto löschen
          </button>
        </>
      ) : (
        <>
          <p role="status" className="m-0 mt-1 text-[14px] text-slate-600">Wir haben Ihnen einen Code geschickt. Mit dem Code wird das Konto endgültig gelöscht.</p>
          <CodeForm id="delete-code" label="Endgültig löschen" busy={busy} error={error} danger onSubmit={(c) => void finish(c)} onCancel={() => { setStep("idle"); setError(""); }} />
        </>
      )}
    </section>
  );
}

function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() =>
        void logout().then(() => {
          router.push("/");
        })
      }
    >
      Abmelden
    </button>
  );
}
