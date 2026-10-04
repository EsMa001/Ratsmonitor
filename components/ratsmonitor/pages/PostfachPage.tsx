import { useEffect, useState } from "react";
import { PageHead } from "../info/blocks";
import { deleteMails, markMailsRead, useTestMails } from "../lib/testAuth";

/** Test-Postfach: E-Mails, die im echten Betrieb verschickt würden (Registrierung, Passwort, Benachrichtigungen) */
export function PostfachPage() {
  const mails = useTestMails();
  const [open, setOpen] = useState<string | null>(null);
  /* Beim Öffnen der Seite alles als gelesen markieren (Zähler im Kontomenü) */
  useEffect(() => {
    if (mails.some((m) => !m.read)) markMailsRead();
  }, [mails]);
  return (
    <>
      <PageHead icon="mail" label="Konto" name="Test-Postfach" title="Test-Postfach" lead="Hier landen alle E-Mails, die im echten Betrieb verschickt würden. Es wird nichts versendet." />
      <section className="ri-sec ri-sec--tight">
        {!mails.length ? (
          <p className="text-slate-500">Noch keine E-Mails. Registrieren Sie ein Testkonto oder nutzen Sie „Passwort vergessen?“.</p>
        ) : (
          <>
            <ul className="m-0 list-none p-0">
              {mails.map((m) => (
                <li key={m.id} className="border-b border-slate-200 last:border-b-0">
                  <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id} className="flex w-full items-baseline gap-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-slate-900">{m.subject}</span>
                      <span className="block text-[14px] text-slate-500">an {m.to}</span>
                    </span>
                    <span className="flex-none text-[12px] text-slate-500">{new Date(m.date).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
                  </button>
                  {open === m.id && <p className="m-0 whitespace-pre-line pb-4 text-[14px] leading-relaxed text-slate-600">{m.body}</p>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={deleteMails} className="mt-6 text-[14px] text-teal-600 hover:underline">
              Postfach leeren
            </button>
          </>
        )}
      </section>
    </>
  );
}
