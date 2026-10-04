import Link from "next/link";
import { useBrand } from "../lib/brand";
import { DarkCta, PageHead } from "./blocks";

/* Die beiden Gründer. Platzhalter, bis Namen, Rollen, Werdegang und Fotos freigegeben sind */
const FOUNDERS: { name: string; role: string; bio: string; initials: string }[] = [
  { name: "[Vorname Nachname]", role: "Mitgründer · [Rolle, z. B. Produkt & Vertrieb]", bio: "[Kurzer Werdegang: Ausbildung, bisherige Stationen, was ihn oder sie zu diesem Thema gebracht hat.]", initials: "?" },
  { name: "[Vorname Nachname]", role: "Mitgründer · [Rolle, z. B. Technik & Daten]", bio: "[Kurzer Werdegang: Ausbildung, bisherige Stationen, was ihn oder sie zu diesem Thema gebracht hat.]", initials: "?" },
];

/** Über uns: die Gründer und ihre Geschichte. Was das Produkt kann, steht auf der Produktseite */
export function UeberUnsPage() {
  const { name } = useBrand();
  return (
    <>
      <PageHead
        icon="users"
        label="Informationen"
        name="Über uns"
        title={<>Die Menschen<br />hinter {name}.</>}
        lead={`${name} wurde von zwei Gründern ins Leben gerufen, die kommunale Entscheidungen für alle früh sichtbar machen wollen.`}
      />

      <section className="ri-sec">
        <h2 className="ri-h2">Die Gründer</h2>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          {FOUNDERS.map((f, i) => (
            <article key={i} className="flex gap-5">
              {/* Foto-Platzhalter */}
              <div aria-hidden="true" className="grid h-24 w-24 flex-none place-items-center rounded-full bg-teal-50 text-[28px] font-semibold text-teal-600">
                {f.initials}
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-[18px] font-semibold text-slate-900">{f.name}</h3>
                <p className="m-0 mt-1 text-[14px] text-teal-600">{f.role}</p>
                <p className="m-0 mt-3 text-[16px] leading-relaxed text-slate-500">{f.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ri-sec">
        <div className="ri-two">
          <h2 className="ri-h2">Wie alles begann</h2>
          <p className="text-slate-500">
            [Platzhalter für die Gründungsgeschichte: Wann und wo habt ihr euch kennengelernt? Welches Erlebnis oder Problem hat zur Idee geführt? Seit wann gibt es {name},
            und wo sitzt ihr?]
          </p>
        </div>
      </section>

      <DarkCta
        title="Sprechen Sie mit uns"
        sub="Fragen, Feedback oder Interesse an einer Zusammenarbeit? Wir freuen uns auf Ihre Nachricht."
        action={
          <Link href="/kontakt" className="ri-btn ri-btn--inv">
            Kontakt aufnehmen
          </Link>
        }
      />
    </>
  );
}
