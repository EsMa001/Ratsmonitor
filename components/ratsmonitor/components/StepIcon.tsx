import { Ban, CircleCheck, CircleHelp, CirclePause, CircleX, ClipboardList, Coins, Construction, Ellipsis, Eye, FileCheck, FilePen, Flag, Gavel, Handshake, Hourglass, Info, Lightbulb, Megaphone, Rocket, Scale, ThumbsUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* Icons des Stands der Signale (Schritt, Vorgangsart oder Status; Namen aus shared/model/names.mjs und den früheren Schritten der Bauleitplanung) */
const STEP_ICONS: Record<string, LucideIcon> = {
  // Schritt des Verfahrens
  Start: Flag, Aufstellung: Flag, "Start und Beauftragung": Flag,
  "Frühe Phase": Users, "Frühzeitige Beteiligung": Users, "Analyse und Zwischenstand": Users,
  Entwurf: FilePen, Offenlage: FilePen, "Entwurf und Beteiligung": FilePen,
  Abwägung: Scale,
  Beschluss: Gavel, Satzungsbeschluss: Gavel, "Wärmeplan vorgelegt": Gavel,
  Umsetzung: Construction, "Umsetzung und Fortschreibung": Construction,
  Aufhebung: Ban,
  // Vorgangsart
  Information: Info, "Antrag aus der Politik": Megaphone, "Antrag und Anfrage": Megaphone, "Genehmigung für Dritte": FileCheck,
  "Planung und Regelung": ClipboardList, "Bau und Vergabe": Construction, Geld: Coins, "Vertrag und Grundstück": Handshake,
  // Status (Ausschreibungen)
  Angekündigt: Hourglass, "In Beratung": Lightbulb, Empfohlen: ThumbsUp, Empfehlung: ThumbsUp, Beschlossen: CircleCheck, Abgelehnt: CircleX,
  Vertagt: CirclePause, "Zur Kenntnis": Eye, "Stand offen": CircleHelp,
  Ausschreibung: Megaphone, Vergabe: Rocket, Nachtrag: FilePen,
};

/** Icon zum Stand eines Vorgangs (Filter über der Liste und Zeilen der Liste); unbekannt oder „Sonstiges“: drei Punkte */
export function StepIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = STEP_ICONS[name] ?? Ellipsis;
  return <Icon size={size} strokeWidth={1.4} aria-hidden="true" className={className} />;
}
