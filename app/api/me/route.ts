// Zustand des Kontos: Stufe, Rollen, Rechte, Zugangsmodus. Ohne Sitzung: Gast. Ohne Kontendatei: {accounts:false}.
import {env} from 'cloudflare:workers';
import {accountRoute} from '@/server/services/session';
import {accountsConfig} from '@/server/accounts/config.mjs';
import {me} from '@/server/accounts/login.mjs';
import {respond} from '@/server/accounts/http.mjs';
export const dynamic='force-dynamic';
const withAccounts=accountRoute(me);
export async function GET(request:Request){
 const cfg=accountsConfig(env);
 if(!cfg.db||!cfg.secret)return respond({accounts:false});
 return withAccounts(request);
}
