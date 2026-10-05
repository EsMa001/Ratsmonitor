import {redirect} from 'next/navigation';
// Die alte Analyseseite las alle gespeicherten Vorgänge in den Speicher (bei 900.000 Vorgängen Absturz des Workers,
// requirements/performance-konzept-2026-10-05.md). Die Ratsmonitor-Oberfläche verlinkt sie nicht mehr.
export default function Page(){redirect('/');}
