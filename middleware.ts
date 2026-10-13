import {NextResponse,type NextRequest} from 'next/server';
import {env} from 'cloudflare:workers';
import {accessDecision,auditAdmin} from '@/server/accounts/access.mjs';
// 1. Zugangssperre im Einladungsmodus (RM_ACCESS=invite, server/accounts/access.mjs); die Datenrouten prüfen zusätzlich
//    selbst (guard in server/services/session.ts), falls die Middleware übersprungen würde.
// 2. Administration, Anmeldung und Konto: nie zwischenspeichern, nicht indexieren.
const PRIVATE=/^\/(admin|api\/admin|api\/auth|api\/me|anmelden|konto)(\/|$)/;
export async function middleware(request:NextRequest){
 const decision=await accessDecision(request,env) as {allow?:boolean;status?:number;redirect?:string};
 if(decision.status)return NextResponse.json({error:'Bitte anmelden.'},{status:decision.status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
 if(decision.redirect)return NextResponse.redirect(new URL(decision.redirect,request.url),{status:302});
 await auditAdmin(request,env);
 const response=NextResponse.next();
 if(PRIVATE.test(request.nextUrl.pathname)){response.headers.set('Cache-Control','private, no-store, max-age=0');response.headers.set('X-Robots-Tag','noindex, nofollow');}
 return response;
}
// Alle Pfade außer den statischen Bündeln; weitere statische Dateien lässt access.mjs (STATIC) ohne Prüfung durch.
export const config={matcher:['/((?!_next/static|_next/image|assets/).*)']};
