'use client';
import {AdminEstimate} from '@/components/admin-estimate';
/** Admin page "Hochrechnung": Germany-wide estimate of the report volume. Reads only; nothing is started from here.
 *  Kopfband (AdminPageHead mit StandLine) und Inhalt zeichnet AdminEstimate, weil dort Laden, Fehler und „Neu berechnen“ liegen. */
export function AdminForecast(props:{displayName?:string;signOutPath?:string}){
 void props;
 return <AdminEstimate revision={0}/>;
}
