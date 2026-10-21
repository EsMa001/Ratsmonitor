import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHead } from "./blocks";
import { api } from "../lib/account";

/* Zustimmung für den Kunden-MCP (OAuth, server/accounts/oauth.mjs): eine Anwendung wie Claude oder ChatGPT möchte im
   Namen dieses Kontos Berichte lesen. Gebiete und Grenzen legt der Betreiber fest (Kundendatei), hier wird nur zugestimmt. */
type Customer = { identity: string; name: string; regionCount: number; regions: string[] };
type Info = { signedIn: false; app: { name: string; host: string } } | { signedIn: true; app: { name: string; host: string }; customers: Customer[] };

export function ConnectPage() {
  const anfrage = useSearchParams().get("anfrage") ?? "";
  const [info, setInfo] = useState<{ key: string; data?: Info; error?: string } | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    (anfrage ? api<Info>("/api/oauth/request?anfrage=" + encodeURIComponent(anfrage)) : Promise.reject(new Error("In der Adresse fehlt die Anfrage. Bitte starten Sie die Verbindung in der Anwendung neu.")))
      .then((data) => live && setInfo({ key: anfrage, data }))
      .catch((e: Error) => live && setInfo({ key: anfrage, error: e.message }));
    return () => {
      live = false;
    };
  }, [anfrage]);
  useEffect(() => {
    if (info) heading.current?.focus();
  }, [info]);

  const data = info?.key === anfrage ? info.data : undefined;
  const customers = data?.signedIn ? data.customers : [];
  const selected = choice || (customers.length === 1 ? customers[0].identity : "");
  const decide = async (allow: boolean) => {
    if (allow && !selected) return setError("Bitte wählen Sie einen Zugang.");
    setBusy(true);
    setError("");
    try {
      const r = await api<{ redirect: string }>("/api/oauth/decide", { method: "POST", body: { anfrage, allow, customer: selected } });
      window.location.assign(r.redirect);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const back = "/verbinden?anfrage=" + encodeURIComponent(anfrage);

  return (
    <>
      <PageHead icon="user" label="Konto" name="Verbinden" title="KI-Assistent verbinden" />
      <section className="ri-sec">
        <div className="ri-form ri-form--center">
          {!info && (
            <p role="status" style={{ margin: 0 }}>
              Anfrage wird geprüft …
            </p>
          )}
          {info?.error && (
            <>
              <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none">
                Anfrage nicht gültig
              </h2>
              <p role="alert" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                {info.error}
              </p>
            </>
          )}
          {data && !data.signedIn && (
            <>
              <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none" style={{ overflowWrap: "anywhere" }}>
                {data.app.name} möchte sich mit Plenara verbinden
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>Bitte melden Sie sich zuerst an. Danach kommen Sie hierher zurück und entscheiden.</p>
              <Link href={"/anmelden?weiter=" + encodeURIComponent(back)} className="ri-btn ri-btn--dark ri-btn--block ri-submit">
                Anmelden →
              </Link>
            </>
          )}
          {data?.signedIn && (
            <>
              <h2 ref={heading} tabIndex={-1} className="m-0 text-[22px] font-semibold outline-none" style={{ overflowWrap: "anywhere" }}>
                {data.app.name} mit Plenara verbinden?
              </h2>
              {customers.length ? (
                <>
                  <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                    Die Anwendung darf veröffentlichte Berichte lesen, durchsuchen und zählen, nur in den Gebieten Ihres Zugangs. Sie kann nichts ändern und sieht weder Ihre gespeicherten Suchen und Artikel noch Ihre Kontodaten.
                  </p>
                  {customers.length > 1 ? (
                    <fieldset style={{ margin: "16px 0 0", padding: 0, border: 0 }}>
                      <legend style={{ fontSize: 14, color: "var(--rm-c600)" }}>Zugang</legend>
                      {customers.map((c) => (
                        <label key={c.identity} style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 8, fontSize: 16 }}>
                          <input type="radio" name="zugang" value={c.identity} checked={selected === c.identity} onChange={() => setChoice(c.identity)} />
                          <span>
                            {c.name} <span style={{ color: "var(--rm-c600)", fontSize: 14 }}>· {regionText(c)}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--rm-c600)" }}>
                      Zugang {customers[0].name}: {regionText(customers[0])}
                    </p>
                  )}
                  <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--rm-c600)" }}>
                    Danach geht es zurück zu {data.app.host}. Die Verbindung gilt, bis Sie sie in der Anwendung trennen oder Ihr Zugang endet.
                  </p>
                </>
              ) : (
                <p role="alert" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>
                  Für Ihr Konto ist der Zugang für KI-Assistenten nicht freigeschaltet. Bitte wenden Sie sich an uns über <Link href="/kontakt">Kontakt</Link>.
                </p>
              )}
              {error && (
                <p role="alert" className="ri-err">
                  {error}
                </p>
              )}
              {customers.length > 0 && (
                <button type="button" disabled={busy} className="ri-btn ri-btn--dark ri-btn--block ri-submit" onClick={() => decide(true)}>
                  {busy ? "Wird verbunden …" : "Zulassen →"}
                </button>
              )}
              <button type="button" disabled={busy} className="ri-btn ri-btn--light ri-btn--block" style={{ marginTop: 8 }} onClick={() => decide(false)}>
                Ablehnen
              </button>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function regionText(c: Customer) {
  const rest = c.regionCount - c.regions.length;
  return c.regions.join(", ") + (rest > 0 ? ` und ${rest} weitere` : "");
}
