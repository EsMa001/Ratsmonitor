import {redirect} from 'next/navigation';
// Registrieren und Anmelden sind ein Weg (E-Mail-Link oder Code): /registrieren führt auf /anmelden
export default function Page(){redirect('/anmelden');}
